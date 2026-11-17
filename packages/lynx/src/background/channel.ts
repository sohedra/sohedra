// The background's side of the wire (src/wire/): the renderer's ops and the calls made of the
// main thread go out in the order they were made, as one patch after the batch of Svelte's
// updates that made them (a microtask), or at once after an event. Events and the answers to
// calls come back as messages, and a message of another page is dropped here.

import {
	checkMessage,
	decodeError,
	decodeToBackground,
	encodeCall,
	encodeCell,
	encodePatch,
	keepsMessage,
	OpCode,
	PATCH_METHOD,
	ROOT_ID,
	TO_BACKGROUND,
} from "../wire/index.ts";
import type {
	CallRequest,
	Op,
	PatchItem,
	PatchParams,
	RewriteMessage,
	SentEvent,
} from "../wire/index.ts";
import { backgroundError } from "./catalogue.ts";
import type { BackgroundError } from "./catalogue.ts";
import { background, DEV } from "./globals.ts";
import type { CoreMessage } from "./globals.ts";
import { currentPage } from "./page-state.ts";
import type { OpQueue } from "./renderer/queue.ts";
import { reportError } from "./report.ts";
import { createSplitter } from "./split.ts";

/** What a channel is opened with. */
export interface ChannelOptions {
	/** Where the renderer puts its ops. */
	queue: OpQueue;
	/** Runs the handlers of an event the main thread sent. */
	onEvent(handler: number, event: SentEvent): void;
	/** The main thread asks for elements' subtrees again (`rewrite`). */
	onRewrite(message: RewriteMessage): void;
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
	 * The page was bumped: the ops made so far and the calls waiting belong to a page the main
	 * thread no longer shows. The ops are dropped, and the calls reject.
	 */
	abandon(): void;
	/** The page is destroyed: `abandon`, and nothing is sent or received after. */
	close(): void;
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
	resolve(value: unknown): void;
	reject(error: BackgroundError | Error): void;
}

/** Opens the page's channel. */
export function openChannel({ queue, onEvent, onRewrite, tagOf }: ChannelOptions): Channel {
	const nativeApp = background.lynx.getNativeApp();
	const core = background.lynx.getCoreContext();
	const waiting = new Map<number, Waiting>();
	let items: PatchItem[] = [];
	let dataUpdated = false;
	let rendered: number | undefined;
	let scheduled = false;
	let nextCall = 1;
	let open = true;

	/** `ops` without those that cannot be sent; each one dropped is reported. */
	function sendable(ops: Op[]): Op[] {
		return ops.filter((op) => {
			const reason = unsendable(op);
			if (reason === undefined) return true;
			const id = op[1];
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

	const encode = (ops: Op[]): string => {
		try {
			return encodeCell(ops);
		} catch {
			return encodeCell(sendable(ops));
		}
	};
	let splitter = createSplitter(encode);

	/** Moves the renderer's queued ops into the patch being written, in order. */
	function takeOps(): void {
		if (queue.size === 0) return;
		for (const item of splitter.split(queue.take())) items.push(item);
	}

	function flush(always = false): void {
		scheduled = false;
		if (!open) return;
		takeOps();
		if (items.length === 0 && !dataUpdated && !always) return;
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
			onEvent(received.handler, received.event);
			return;
		}
		if (received.t === "rewrite") {
			onRewrite(received);
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
		// Calls of background functions, releases and errors are for the page's later parts: the
		// main-thread functions' runtime and the page's error handler.
	}

	core.addEventListener(TO_BACKGROUND.events, onMessage);
	core.addEventListener(TO_BACKGROUND.replies, onMessage);

	function abandon(): void {
		splitter.split(queue.take());
		items = [];
		dataUpdated = false;
		rendered = undefined;
		scheduled = false;
		const ended = [...waiting.values()];
		waiting.clear();
		for (const entry of ended) entry.reject(gone(entry.request));
	}

	return {
		flush,
		call(element, request) {
			if (!open) return Promise.reject(gone(request));
			let text: string;
			try {
				text = encodeCall(request);
			} catch (error) {
				return Promise.reject(error);
			}
			const id = nextCall++;
			return new Promise((resolve, reject) => {
				waiting.set(id, { request, resolve, reject });
				takeOps();
				items.push(["call", id, element, text]);
				schedule();
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
			// The page is written from nothing: its lists are told every item again.
			splitter = createSplitter(encode);
			items.push(["rewrite", ROOT_ID]);
			write();
			flush(true);
		},
		abandon,
		close() {
			abandon();
			open = false;
			queue.onPending = () => {};
			core.removeEventListener(TO_BACKGROUND.events, onMessage);
			core.removeEventListener(TO_BACKGROUND.replies, onMessage);
		},
	};
}
