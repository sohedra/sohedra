// The main thread of a Svelte page. Svelte runs on the background; this side builds Lynx's
// elements, which must happen here. It
//   - makes the page when the engine renders it, and flushes its updates;
//   - applies each patch the background sends (`callLepusMethod(PATCH_METHOD)`) and flushes the
//     tree once for it;
//   - keeps each list cell's ops as they came until the list shows the cell;
//   - answers the calls a patch carries;
//   - sends the elements' events to the background;
//   - starts the page over when it reloads, and lets go of it when its life ends.

import {
	checkMessage,
	decodeCall,
	decodeError,
	decodePatch,
	describeOp,
	encodeError,
	encodeToBackground,
	keepsMessage,
	OpCode,
	PATCH_METHOD,
} from "../wire/index.ts";
import type {
	CallItem,
	Op,
	PatchParams,
	Result,
	SentEvent,
	SentTarget,
	ToBackground,
} from "../wire/index.ts";
import { createApplier } from "./apply.ts";
import type { Applier } from "./apply.ts";
import { mainThreadError } from "./catalogue.ts";
import { fillEngineGaps } from "./engine-gaps.ts";
import { DEV, globalScope, mainThread, setGlobalFunction } from "./globals.ts";
import type { EngineMessage, InvokeResult, LynxElement } from "./globals.ts";

/** Lynx's error code of an error on the main thread (`LYNX_ERROR_CODE_LEPUS`). */
const MAIN_THREAD_ERROR = 1101;

/** Reports an error into Lynx, with Lynx's code for the main thread. Never throws. */
function reportIntoLynx(error: Error): void {
	try {
		if (typeof mainThread._ReportError === "function")
			mainThread._ReportError(error, { errorCode: MAIN_THREAD_ERROR });
		else mainThread.lynx.reportError(error);
	} catch {
		// Reporting must never throw over the error.
	}
}

/** The arguments of an engine event, which the engine sends as an array. */
const argsOf = (event: EngineMessage): unknown[] =>
	Array.isArray(event.data) ? event.data : [event.data];

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === "object" && value !== null;

/**
 * Starts the main thread's runtime: it fills in what the engine lacks, listens to the engine and
 * takes the background's patches.
 */
export function startMainThread(): void {
	const { lynx } = mainThread;
	fillEngineGaps(globalScope, lynx);
	const engine = lynx.getEngine();
	const native = lynx.getNative();
	/** The page the main thread shows: bumped when the page reloads and when it ends. */
	let generation = 0;
	let page: LynxElement | undefined;
	let applier: Applier | undefined;
	/** The elements of the page before a reload, shown until the new page's first patch. */
	let previous: Applier | undefined;
	/** Patches that came before the engine rendered the page. */
	const early: PatchParams[] = [];
	/** The page's life has ended: a patch that comes after is for no page, and is dropped. */
	let destroyed = false;
	/** Whether the background's page is shown: a patch of it was applied. */
	let shown = false;
	/** New data came before the background's page was shown: its first patch shows the data. */
	let dataHeld = false;
	/** The ops of each list cell the list has not shown yet, as they came. */
	const cells = new Map<number, string[]>();

	function send(message: ToBackground, stamp: number = generation): void {
		lynx.getJSContext().dispatchEvent(encodeToBackground(message, stamp));
	}

	/** Reports an error into Lynx, and tells the background, which has the page's error handler. */
	function report(error: unknown, op?: Op): void {
		const thrown = error instanceof Error ? error : new Error(String(error));
		reportIntoLynx(thrown);
		try {
			const message: ToBackground = { t: "error", error: encodeError(thrown) };
			if (DEV && op) message.op = op;
			send(message);
		} catch {
			// No background to tell: Lynx has the report.
		}
	}

	function target(value: unknown): SentTarget | undefined {
		if (!isRecord(value)) return undefined;
		const uid = typeof value["uid"] === "number" ? value["uid"] : undefined;
		const sent: SentTarget = { node: (uid !== undefined && applier?.idForUid(uid)) || 0 };
		if (typeof value["id"] === "string") sent.id = value["id"];
		if (uid !== undefined) sent.uid = uid;
		if (isRecord(value["dataset"])) sent.dataset = value["dataset"];
		return sent;
	}

	/** A copy of a Lynx event as plain data, with its targets named by the background's ids. */
	function sentEvent(event: unknown): SentEvent {
		const copy: SentEvent = {};
		if (!isRecord(event)) return copy;
		for (const key of Object.keys(event)) {
			const value = event[key];
			if (key !== "target" && key !== "currentTarget" && typeof value !== "function")
				copy[key] = value;
		}
		const eventTarget = target(event["target"]);
		const current = target(event["currentTarget"]);
		if (eventTarget) copy.target = eventTarget;
		if (current) copy.currentTarget = current;
		return copy;
	}

	function onElementEvent(handler: number, event: unknown): void {
		try {
			send({ t: "event", handler, event: sentEvent(event) });
		} catch (error) {
			report(error);
		}
	}

	function apply(ops: Op[]): void {
		for (const op of ops) if (op[0] === OpCode.Release) cells.delete(op[1]);
		for (const { op, error } of applier!.apply(ops)) {
			const reason = error instanceof Error ? error.message : String(error);
			const change = DEV ? describeOp(op) : undefined;
			report(mainThreadError({ code: "change_not_applied", details: { reason, change } }), op);
		}
	}

	/** Runs a call of the patch, and sends its result back when the call wants one. */
	function call([, id, element, text]: CallItem, stamp: number): void {
		const answer = (result: Result): void => {
			if (id !== 0) send({ t: "reply", id, result }, stamp);
			else if (!result.ok) report(decodeError(result.error));
		};
		try {
			const request = decodeCall(text);
			if (request[0] !== "invoke")
				throw mainThreadError({ code: "call_not_supported", details: { kind: request[0] } });
			const [, method, params] = request;
			const node = applier!.element(element);
			if (node === undefined)
				throw mainThreadError({ code: "element_missing", details: { id: element } });
			mainThread.__InvokeUIMethod(node, method, params, (result: InvokeResult) => {
				answer(
					result.code === 0
						? { ok: true, value: result.data ?? null }
						: {
								ok: false,
								error: encodeError(
									mainThreadError({
										code: "ui_method_failed",
										details: { method, code: result.code },
									}),
								),
							},
				);
			});
		} catch (error) {
			answer({ ok: false, error: encodeError(error) });
		}
	}

	/** Applies a patch of the page it shows, then flushes the tree once. */
	function applyPatch(params: PatchParams): void {
		const patch = decodePatch(params);
		if (DEV) checkMessage(patch, { thread: "main-thread", page: generation });
		if (!keepsMessage(patch, generation)) return;
		shown = true;
		// The new page replaces the old one in the same flush, with no empty frame between.
		previous?.clear();
		previous = undefined;
		for (const item of patch.items) {
			switch (item[0]) {
				case "ops":
					apply(item[1]);
					break;
				case "cell": {
					// Kept as text until the list shows the cell.
					let parts = cells.get(item[1]);
					if (!parts) cells.set(item[1], (parts = []));
					parts.push(item[2]);
					break;
				}
				case "call":
					call(item, patch.page);
					break;
				case "reply":
					// The answers to main-thread functions' calls, which their runtime reads.
					break;
			}
		}
		const dataUpdated = patch.dataUpdated === true || dataHeld;
		dataHeld = false;
		mainThread.__FlushElementTree(page, dataUpdated ? { triggerDataUpdated: true } : {});
	}

	function onPatch(params: PatchParams): void {
		if (destroyed) return;
		if (!applier) {
			early.push(params);
			return;
		}
		try {
			applyPatch(params);
		} catch (error) {
			report(error);
		}
	}

	function onRenderPage(): void {
		try {
			page = mainThread.__CreatePage("0", 0);
			applier = createApplier(page, onElementEvent);
			// No flush: the engine flushes the tree after the render.
			for (const params of early.splice(0)) applyPatch(params);
		} catch (error) {
			report(error);
		}
	}

	function onUpdatePage(event: EngineMessage): void {
		try {
			const [, given] = argsOf(event);
			const options: Record<string, unknown> = isRecord(given) ? { ...given } : {};
			if (options["reloadTemplate"] === true) {
				// The page starts over: the old page hears no more events, and the background's next
				// patch, of the new page, makes it again.
				generation++;
				applier?.silence();
				if (shown || !previous) {
					previous?.clear();
					previous = applier;
				} else {
					// A reload during a reload: the page on screen is still the one before both.
					applier?.clear();
				}
				if (page) applier = createApplier(page, onElementEvent);
				cells.clear();
				shown = false;
				dataHeld = false;
			} else if (!shown) {
				// The page shows nothing of the data until the background's first patch: its flush
				// carries the flag.
				dataHeld = true;
			}
			if (page) mainThread.__FlushElementTree(page, options);
		} catch (error) {
			report(error);
		}
	}

	function onDestroyLifetime(): void {
		try {
			generation++;
			destroyed = true;
			engine.removeEventListener("__RenderPage", onRenderPage);
			engine.removeEventListener("__UpdatePage", onUpdatePage);
			native.removeEventListener("__DestroyLifetime", onDestroyLifetime);
			for (const old of [previous, applier]) {
				old?.silence();
				old?.clear();
			}
			previous = applier = undefined;
			early.length = 0;
			cells.clear();
		} catch (error) {
			report(error);
		}
	}

	engine.addEventListener("__RenderPage", onRenderPage);
	engine.addEventListener("__UpdatePage", onUpdatePage);
	// The page's end comes from the native side (core/shell/lynx_shell.cc), not from the engine.
	native.addEventListener("__DestroyLifetime", onDestroyLifetime);
	setGlobalFunction(PATCH_METHOD, onPatch);
	// The functions the engine calls by name when nothing listens for its event
	// (core/renderer/template_assembler.cc): `removeComponents` at a reload, before the page is
	// updated with `reloadTemplate`; `updateGlobalProps` with new global props, which the
	// background holds, so the tree is only flushed, as ReactLynx does; `getPageData` for the
	// host's `getCurrentData()`, whose data lives on the background.
	setGlobalFunction("removeComponents", () => {});
	setGlobalFunction("updateGlobalProps", (_data: unknown, options?: unknown) => {
		if (page) mainThread.__FlushElementTree(page, isRecord(options) ? options : {});
	});
	setGlobalFunction("getPageData", () => null);
	// The engine runs the page's data through this before each render and update
	// (core/renderer/template_assembler.cc, ProcessTemplateDataForFiber); the page keeps it as is.
	setGlobalFunction("processData", (data: unknown) => data);
}
