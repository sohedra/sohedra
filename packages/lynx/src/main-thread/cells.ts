// The list cells of the page as text: a cell's ops wait as the background sent them until its list
// shows the cell, and are applied then. The main thread asks the background to write cells again,
// in one message on a later task: those its lists let go of, and those never shown whose kept text
// piled up. The answer replaces what was kept.

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
export interface CellsOptions {
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
}

/** The cells of the page `page`. */
export function createCells({ page, apply, send, report, later }: CellsOptions): Cells {
	let due = false;

	function askForRewrites(): void {
		due = false;
		// A page written again, or gone, has none of its cells to let go of.
		if (page.destroyed || page.rewriting || !page.applier) return;
		try {
			const nodes = page.applier.takeRewrites(CELLS_PER_REQUEST);
			if (nodes.length > 0) send({ t: "rewrite", nodes });
			if (nodes.length === CELLS_PER_REQUEST) schedule();
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

	return {
		open(id) {
			const parts = page.cells.get(id);
			if (!parts) return;
			page.cells.delete(id);
			for (const part of parts) apply(decodeCell(part));
		},
		take(item) {
			const [, id, text] = item;
			if (item[3] === true) {
				if (page.applier!.replaceCell(id, text)) page.cells.set(id, [text]);
				return;
			}
			// A cell the list shows already takes it now; else it is kept as text until it does.
			if (page.applier!.element(id)) {
				apply(decodeCell(text));
				return;
			}
			let parts = page.cells.get(id);
			if (!parts) page.cells.set(id, (parts = []));
			parts.push(text);
			if (piledUp(parts)) page.applier!.askCell(id);
		},
		schedule,
	};
}
