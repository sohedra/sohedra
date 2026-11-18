// The background's side of the wire (src/wire/): the renderer's ops and the calls made of the
// main thread go out in the order they were made, as one patch after the batch of Svelte's
// updates that made them (a microtask), or at once after an event. Events and the answers to
// calls come back as messages, and a message of another page is dropped here.
//
// Where an op or a call becomes text, each main-thread function in a `main-thread:` attribute or a
// call that reaches a background function gets its context (./functions/contexts.ts): what is never
// sent holds none. A cell item lists the contexts its text holds, for the main thread to let go of
// when it lets go of the text unread.

import {
	checkMessage,
	decodeError,
	decodeToBackground,
	encodeCall,
	encodeCell,
	encodeError,
	encodePatch,
	encodeResult,
	keepsMessage,
	MAIN_THREAD_PREFIX,
	OpCode,
	PATCH_METHOD,
	ROOT_ID,
	TO_BACKGROUND,
} from "../wire/index.ts";
import type {
	AttrValue,
	CallMessage,
	CallRequest,
	HideMessage,
	Op,
	PatchItem,
	PatchParams,
	PropsIdsMessage,
	Result,
	RewriteMessage,
	SentEvent,
	ShowMessage,
} from "../wire/index.ts";
import { backgroundError } from "./catalogue.ts";
import type { BackgroundError } from "./catalogue.ts";
import { contextsIn, createContexts } from "./functions/contexts.ts";
import { takeCollectedRefs } from "./functions/refs.ts";
import { background, DEV } from "./globals.ts";
import type { CoreMessage } from "./globals.ts";
import { currentPage } from "./page-state.ts";
import type { OpQueue } from "./renderer/queue.ts";
import { reportError } from "./report.ts";
import { cellItem, createSplitter } from "./split.ts";
import type { CellText } from "./split.ts";

/** What a channel is opened with. */
export interface ChannelOptions {
	/** Where the renderer puts its ops. */
	queue: OpQueue;
	/** Runs the handlers of an event the main thread sent. */
	onEvent(handler: number, event: SentEvent, input: number | undefined): void;
	/** The main thread asks for elements' subtrees again (`rewrite`). */
	onRewrite(message: RewriteMessage): void;
	/** In a development build, the ids of `$props.id()` that hydration wrote over (`props-ids`). */
	onPropsIds(message: PropsIdsMessage): void;
	/** The main thread asks for deferred rows Lynx asked for (`show`). */
	onShow?(message: ShowMessage): void;
	/** The main thread let go of deferred rows and their text (`hide`). */
	onHide?(message: HideMessage): void;
	/** A main-thread function calls a background function (`call`), answered with `reply`. */
	onCall?(message: CallMessage): void;
	/** Whether a new cell of a list of the page is held back until it is asked for. */
	waits?(id: number): boolean;
	/** An element's tag, for the error of a value that cannot be sent. */
	tagOf(id: number): string | undefined;
}

/** The page's way to the main thread. */
export interface Channel {
	/** Sends what is queued now, as one patch; with `always`, a patch even with nothing in it. */
	flush(always?: boolean): void;
	/**
	 * Asks the main thread something about an element (0 for none), in line with the ops made
	 * before: resolves with the answer. Rejects with the `page_is_gone` error when the page reloads
	 * or is destroyed before the answer, or was already.
	 */
	call(element: number, request: CallRequest): Promise<unknown>;
	/** The next patch shows the page's new data; one is sent even with nothing else in it. */
	markDataUpdated(): void;
	/**
	 * The page's components have rendered, and their effects have not run: the next patch says how
	 * many of its items hold the page as rendered, which the main thread hydrates its first frame
	 * from.
	 */
	markRendered(): void;
	/**
	 * Writes the whole page again, after what is queued: a patch with a rewrite item for the page's
	 * root, then what `write` makes, from nothing.
	 */
	rewritePage(write: () => void): void;
	/**
	 * Writes list cells again, after what is queued: for each id, what `write` makes, as a cell item
	 * marked with what `write` returns (see `CellItem`), and sent from then on if it was held back.
	 * `write` returns false for an id that is no longer a cell, which gets no item.
	 */
	rewriteCells(ids: readonly number[], write: (id: number) => boolean | "unmount"): void;
	/** Whether a cell is held back: the main thread has no text for it. */
	holds(id: number): boolean;
	/** Holds cells back from now on, the ops already queued included: the main thread let go of them. */
	holdCells(ids: readonly number[]): void;
	/**
	 * The page was bumped: the ops made so far and the calls waiting belong to a page the main
	 * thread no longer shows. The ops are dropped, and the calls reject.
	 */
	abandon(): void;
	/** The page is destroyed: `abandon`, and nothing is sent or received after. */
	close(): void;
	/**
	 * Answers a main-thread function's call of a background function, in the next patch, after
	 * what is queued. A result that cannot be sent answers with that error instead.
	 */
	reply(id: number, result: Result): void;
	/** The background function `fn` that the main-thread function context `context` holds. */
	backgroundFunction(context: number, fn: number): ((...args: unknown[]) => unknown) | undefined;
	/** The ids of the main-thread function contexts kept, for tests. */
	contexts(): number[];
}

/** What a call asked, in the developer's words, for the error when it has no answer. */
function callName(request: CallRequest): string {
	return request[0] === "invoke" ? request[1] : request[0];
}

/** Why `op` cannot be written as text, or `undefined` when it can. */
function unsendable(op: Op): string | undefined {
	try {
		JSON.stringify(op);
		return undefined;
	} catch (error) {
		return error instanceof Error ? error.message : String(error);
	}
}

interface Waiting {
	request: CallRequest;
	/** The contexts its request holds: the main thread has not read it yet. */
	contexts: number[];
	resolve(value: unknown): void;
	reject(error: BackgroundError | Error): void;
}

/** Opens the page's channel. */
export function openChannel(options: ChannelOptions): Channel {
	const { queue, onEvent, onRewrite, onPropsIds, onShow, onHide, onCall, waits, tagOf } = options;
	const nativeApp = background.lynx.getNativeApp();
	const core = background.lynx.getCoreContext();
	const waiting = new Map<number, Waiting>();
	const contexts = createContexts();
	let items: PatchItem[] = [];
	let dataUpdated = false;
	let rendered: number | undefined;
	let scheduled = false;
	let nextCall = 1;
	let open = true;

	/**
	 * `ops` without those that cannot be sent; each one dropped is reported, and the contexts it was
	 * given are let go of, and taken out of `given`.
	 */
	function sendable(ops: Op[], given?: number[]): Op[] {
		return ops.filter((op) => {
			const reason = unsendable(op);
			if (reason === undefined) return true;
			const id = op[1];
			if (op[0] === OpCode.SetAttr) {
				const dropped = contextsIn(op[3]);
				contexts.release(dropped);
				for (const context of dropped) {
					const at = given?.indexOf(context) ?? -1;
					if (at !== -1) given!.splice(at, 1);
				}
			}
			reportError(
				backgroundError({
					code: "attribute_not_copyable",
					details: {
						name: op[0] === OpCode.SetAttr ? op[2] : "update-list-info",
						tag: tagOf(id) ?? "list",
						reason,
					},
				}),
			);
			return false;
		});
	}

	/**
	 * Gives the main-thread functions of `ops` their contexts, in place, as the ops are written as
	 * text; the ids go in `given`. One compare per op that sets no such attribute.
	 */
	function giveContexts(ops: Op[], given: number[]): void {
		for (const op of ops) {
			if (op[0] !== OpCode.SetAttr) continue;
			const value = op[3];
			if (typeof value !== "object" || value === null || !op[2].startsWith(MAIN_THREAD_PREFIX))
				continue;
			// Boundary: a value as it is sent stays a value an attribute takes.
			op[3] = contexts.send(value, given) as AttrValue;
		}
	}

	const encode = (ops: Op[]): CellText => {
		const given: number[] = [];
		giveContexts(ops, given);
		try {
			return { text: encodeCell(ops), contexts: given };
		} catch {
			return { text: encodeCell(sendable(ops, given)), contexts: given };
		}
	};
	let splitter = createSplitter(encode, waits);

	/** Moves the renderer's queued ops into the patch being written, in order. */
	function takeOps(): void {
		if (queue.size === 0) return;
		for (const item of splitter.split(queue.take())) items.push(item);
	}

	function flush(always = false): void {
		scheduled = false;
		if (!open) return;
		takeOps();
		// The refs the page let go of since: the main thread forgets them after what came before.
		const unrefs = takeCollectedRefs();
		if (unrefs.length > 0) items.push(["call", 0, 0, encodeCall(["unref", unrefs])]);
		if (items.length === 0 && !dataUpdated && !always) return;
		const given: number[] = [];
		for (const item of items) if (item[0] === "ops") giveContexts(item[1], given);
		const patch = { page: currentPage(), items, dataUpdated, rendered };
		items = [];
		dataUpdated = false;
		rendered = undefined;
		let params: PatchParams;
		try {
			params = encodePatch(patch);
		} catch {
			const kept = patch.items.map((item): PatchItem =>
				item[0] === "ops" ? ["ops", sendable(item[1])] : item,
			);
			params = encodePatch({ ...patch, items: kept });
		}
		nativeApp.callLepusMethod(PATCH_METHOD, params);
		queue.sent++;
	}

	function schedule(): void {
		if (scheduled || !open) return;
		scheduled = true;
		background.lynx.queueMicrotask(() => {
			if (scheduled) flush();
		});
	}

	queue.onPending = schedule;

	const gone = (request: CallRequest): BackgroundError =>
		backgroundError({ code: "page_is_gone", details: { call: callName(request) } });

	function onMessage(message: CoreMessage): void {
		const page = currentPage();
		let received;
		try {
			received = decodeToBackground(message);
			if (DEV) checkMessage(received, { thread: "background", page });
		} catch (error) {
			reportError(error);
			return;
		}
		if (!open || !keepsMessage(received, page)) return;
		if (received.t === "event") {
			onEvent(received.handler, received.event, received.input);
			return;
		}
		if (received.t === "rewrite") {
			onRewrite(received);
			return;
		}
		if (received.t === "props-ids") {
			onPropsIds(received);
			return;
		}
		if (received.t === "show") {
			onShow?.(received);
			return;
		}
		if (received.t === "hide") {
			onHide?.(received);
			return;
		}
		if (received.t === "call") {
			onCall?.(received);
			return;
		}
		if (received.t === "release") {
			contexts.release(received.contexts);
			return;
		}
		if (received.t === "reply") {
			const entry = waiting.get(received.id);
			if (!entry) return;
			waiting.delete(received.id);
			const { result } = received;
			if (result.ok) entry.resolve(result.value);
			else entry.reject(decodeError(result.error));
		}
		// Errors are for the page's error handler, a later part of the page.
	}

	core.addEventListener(TO_BACKGROUND.events, onMessage);
	core.addEventListener(TO_BACKGROUND.replies, onMessage);

	function abandon(): void {
		splitter.split(queue.take());
		items = [];
		dataUpdated = false;
		rendered = undefined;
		scheduled = false;
		// The main thread lets go of the page's functions with its elements.
		contexts.clear();
		const ended = [...waiting.values()];
		waiting.clear();
		for (const entry of ended) entry.reject(gone(entry.request));
	}

	/** A call item: its id (0 for none wanted), its element and its request, written as text now. */
	function pushCall(id: number, element: number, text: string): void {
		takeOps();
		items.push(["call", id, element, text]);
		schedule();
	}

	return {
		flush,
		call(element, request) {
			if (!open) return Promise.reject(gone(request));
			const given: number[] = [];
			let text: string;
			try {
				const sent: CallRequest =
					request[0] === "run"
						? // Boundary: the function as it is sent stays a main-thread function, and its params a list.
							(contexts.send(request, given) as CallRequest)
						: request;
				text = encodeCall(sent);
			} catch (error) {
				contexts.release(given);
				return Promise.reject(error);
			}
			const id = nextCall++;
			return new Promise((resolve, reject) => {
				waiting.set(id, { request, contexts: given, resolve, reject });
				pushCall(id, element, text);
			});
		},
		markDataUpdated() {
			if (!open) return;
			dataUpdated = true;
			schedule();
		},
		markRendered() {
			takeOps();
			rendered = items.length;
		},
		rewritePage(write) {
			if (!open) return;
			flush();
			// The main thread applied nothing since it asked for the page again, and lets go of all it
			// had: only the calls that wait for the page hold what it will read.
			const read = new Set<number>();
			for (const entry of waiting.values()) for (const id of entry.contexts) read.add(id);
			contexts.keepOnly(read);
			// The page is written from nothing: its lists are told every item again.
			splitter = createSplitter(encode, waits);
			items.push(["rewrite", ROOT_ID]);
			write();
			flush(true);
		},
		rewriteCells(ids, write) {
			if (!open) return;
			takeOps();
			// A cell's ops are its item as they are: the splitter already knows what is in the cell.
			for (const id of ids) {
				const written = write(id);
				const ops = queue.take();
				if (written === false || ops.length === 0) continue;
				items.push(cellItem(id, encode(ops), written));
				splitter.written(id);
			}
			flush();
		},
		holds: (id) => splitter.holds(id),
		holdCells(ids) {
			for (const id of ids) splitter.hold(id);
		},
		abandon,
		close() {
			abandon();
			open = false;
			queue.onPending = () => {};
			core.removeEventListener(TO_BACKGROUND.events, onMessage);
			core.removeEventListener(TO_BACKGROUND.replies, onMessage);
		},
		reply(id, result) {
			if (!open) return;
			let text: string;
			try {
				text = encodeResult(result);
			} catch (error) {
				text = encodeResult({ ok: false, error: encodeError(error) });
			}
			takeOps();
			items.push(["reply", id, text]);
			schedule();
		},
		backgroundFunction: (context, fn) => contexts.find(context, fn),
		contexts: () => contexts.ids(),
	};
}
