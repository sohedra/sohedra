// The list cells of the page as text: a cell's ops wait as the background sent them until its list
// shows the cell, and are applied then. The main thread asks the background to write cells again,
// in one message on a later task: those its lists let go of, and those never shown whose kept text
// piled up. The answer replaces what was kept.
//
// A deferred row has no text until the background renders it: the lists ask for it (a show
// message, at the end of the task) and its first text comes as a marked cell item. A row deferred
// with `unmountRecycled` loses its text with its elements, and the background is told (a hide
// message) to unmount its contents; until it is written whole again, its ops are dropped.
//
// A text kept holds the contexts its cell item lists: a text let go of unread, replaced or dropped,
// lets go of them, as reading it would have counted them.

import { decodeCell } from "../wire/index.ts";
import type { CellItem, Op, ToBackground } from "../wire/index.ts";
import type { MainThreadPage } from "./page.ts";

/**
 * Whether the pieces of a cell's kept text after the first add up to more than the first: the
 * cell is then written again as one piece. So the text kept for a cell never shown stays within
 * about twice what the cell is, and each byte is sent again about once.
 */
function piledUp(parts: readonly string[]): boolean {
	if (parts.length < 2) return false;
	let rest = 0;
	for (let index = 1; index < parts.length; index++) rest += parts[index]!.length;
	return rest > parts[0]!.length;
}

/**
 * The most cells one request names. 64 rows of the device's feed, 0.9 kB each, come back in about
 * 58 kB, the patch that changes a label in each of 1,000 rows; the rest wait for the next task. A
 * scroll lets a few rows go at a time: only rows whose text piles up in step, changed together on
 * a timer, ask for more.
 */
const CELLS_PER_REQUEST = 64;

/** What the cells need of the runtime. */
interface CellsOptions {
	page: MainThreadPage;
	/** Applies ops to the page, reporting those it cannot. */
	apply(ops: Op[]): void;
	send(message: ToBackground): void;
	report(error: unknown): void;
	/** Runs `callback` on a later task of the main thread. */
	later(callback: () => void): void;
}

/** The page's cells as text. */
export interface Cells {
	/** The list shows a cell: makes it from what was kept. */
	open(id: number): void;
	/** A cell item of a patch: applied to a cell the list shows, else kept, or written again. */
	take(item: CellItem): void;
	/** Asks the background, on a later task, to write again the cells the page's lists name. */
	schedule(): void;
	/** Asks the background, at the end of the task, to render a deferred row and write it. */
	request(id: number): void;
	/** A cell is gone: what was kept for it goes, unread. */
	drop(id: number): void;
}

/** The cells of the page `page`. */
export function createCells({ page, apply, send, report, later }: CellsOptions): Cells {
	let due = false;
	// Deferred rows to ask for and to let go of, sent together at the end of the task: hides first,
	// so a row let go of and asked for again is unmounted before it renders.
	let shows: number[] = [];
	let hides: number[] = [];
	let sending = false;

	function sendRows(): void {
		sending = false;
		const [hidden, shown] = [hides, shows];
		hides = [];
		shows = [];
		if (page.destroyed || page.rewriting) return;
		try {
			if (hidden.length > 0) send({ t: "hide", elements: hidden });
			if (shown.length > 0) send({ t: "show", elements: shown });
		} catch (error) {
			report(error);
		}
	}

	function sendSoon(): void {
		if (sending) return;
		sending = true;
		// Lynx's main thread has no `queueMicrotask` of its own; a promise's reaction runs at the end of the task.
		void Promise.resolve().then(sendRows);
	}

	function askForRewrites(): void {
		due = false;
		// A page written again, or gone, has none of its cells to let go of.
		if (page.destroyed || page.rewriting || !page.applier) return;
		try {
			const elements = page.applier.takeRewrites(CELLS_PER_REQUEST);
			if (elements.length > 0) send({ t: "rewrite", elements });
			if (elements.length === CELLS_PER_REQUEST) schedule();
		} catch (error) {
			report(error);
		}
	}

	function schedule(): void {
		// Never inside Lynx's call of a list, and once for many cells.
		if (due) return;
		due = true;
		later(askForRewrites);
	}

	/** Lets go of what is kept for a cell, unread. */
	function drop(id: number): void {
		page.cells.delete(id);
		const contexts = page.cellContexts.get(id);
		if (!contexts) return;
		page.cellContexts.delete(id);
		page.functions.dropUnread(contexts);
	}

	/** Keeps a text for a cell, after what is kept, or, with `replace`, in its place. */
	function keep(id: number, text: string, contexts: number[] | undefined, replace: boolean): void {
		if (replace) drop(id);
		let parts = page.cells.get(id);
		if (!parts) page.cells.set(id, (parts = []));
		parts.push(text);
		if (contexts === undefined) return;
		const held = page.cellContexts.get(id);
		if (held) held.push(...contexts);
		else page.cellContexts.set(id, [...contexts]);
	}

	return {
		open(id) {
			const parts = page.cells.get(id);
			if (!parts) return;
			// Read now: the contexts the texts hold are counted as the cell is made.
			page.cells.delete(id);
			page.cellContexts.delete(id);
			for (const part of parts) apply(decodeCell(part));
		},
		take(item) {
			const [, id, text, mark, contexts] = item;
			const applier = page.applier!;
			if (mark !== undefined && mark !== null) {
				// A deferred row's first text: the answer to a show message.
				if (!applier.element(id) && !page.cells.has(id)) {
					keep(id, text, contexts, true);
					applier.firstText(id);
					return;
				}
				if (!applier.replaceCell(id, text)) {
					if (contexts) page.functions.dropUnread(contexts);
					return;
				}
				if (mark === true) {
					keep(id, text, contexts, true);
					return;
				}
				// Its contents go, and the text with them.
				drop(id);
				if (contexts) page.functions.dropUnread(contexts);
				applier.hideCell(id);
				hides.push(id);
				sendSoon();
				return;
			}
			// A cell the list shows already takes it now; else it is kept as text until it does.
			if (applier.element(id)) {
				apply(decodeCell(text));
				return;
			}
			// Its text went with its contents: it is written whole when Lynx asks for it again.
			if (applier.isHidden(id)) {
				if (contexts) page.functions.dropUnread(contexts);
				return;
			}
			keep(id, text, contexts, false);
			if (piledUp(page.cells.get(id)!)) applier.askCell(id);
		},
		drop,
		schedule,
		request(id) {
			shows.push(id);
			sendSoon();
		},
	};
}
