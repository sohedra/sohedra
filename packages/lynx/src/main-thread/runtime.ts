// The main thread of a Svelte page. Svelte runs on the background; this side builds Lynx's
// elements, which must happen here. It
//   - makes the page when the engine renders it, draws its first frame (./frame/), and flushes its
//     updates;
//   - hydrates the first frame with the background's first patch (./hydrate/), once the platform
//     has painted the frame (./paint.ts), or asks the background to write the page again when it
//     cannot;
//   - applies each patch the background sends (`callLepusMethod(PATCH_METHOD)`) and flushes the
//     tree once for it;
//   - keeps each list cell's ops as text until the list shows the cell, and asks the background
//     to write cells again (./cells.ts);
//   - answers the calls a patch carries (./calls.ts);
//   - sends the elements' events to the background;
//   - runs main-thread functions (./functions/): the engine's `runWorklet`, and the page's calls;
//   - starts the page over when it reloads, and lets go of it when its life ends.

import {
	checkMessage,
	decodeError,
	decodePatch,
	decodeResult,
	describeOp,
	encodeError,
	encodeToBackground,
	keepsMessage,
	OpCode,
	PATCH_METHOD,
	ROOT_ID,
	RUN_FUNCTION,
} from "../wire/index.ts";
import type {
	Op,
	Patch,
	PatchItem,
	PatchParams,
	RewriteItem,
	SentEvent,
	ToBackground,
} from "../wire/index.ts";
import { createApplier } from "./apply.ts";
import type { Applier } from "./apply.ts";
import { createCalls } from "./calls.ts";
import { mainThreadError } from "./catalogue.ts";
import { createCells } from "./cells.ts";
import type { CodeStyles } from "./code-styles.ts";
import { fillEngineGaps } from "./engine-gaps.ts";
import type { Flattening } from "./flatten.ts";
import { drawRecordedFrame } from "./frame/recorded.ts";
import { createFunctionsPage } from "./functions/page.ts";
import type { FunctionsPage } from "./functions/page.ts";
import {
	DEV,
	functionsGlobal,
	globalScope,
	installRegistry,
	mainThread,
	setGlobalFunction,
} from "./globals.ts";
import type { EngineMessage, LynxElement } from "./globals.ts";
import { hydrate, replayEarly, sentMismatch } from "./hydrate/hydrate.ts";
import { clearPrevious, createMainThreadPage } from "./page.ts";
import type { MainThreadPage } from "./page.ts";
import { afterFirstPaint } from "./paint.ts";
import { isRecord, toSentEvent } from "./sent-event.ts";

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

/** A running main thread: the page it shows, which tests read. */
export interface MainThreadRuntime {
	readonly page: MainThreadPage;
}

/**
 * Starts the main thread's runtime: it fills in what the engine lacks, listens to the engine and
 * takes the background's patches.
 */
export function startMainThread(): MainThreadRuntime {
	const { lynx } = mainThread;
	fillEngineGaps({ scope: globalScope, strings: String.prototype, lynx });
	const engine = lynx.getEngine();
	const native = lynx.getNative();
	const state = createMainThreadPage((scope) => newFunctions(scope, 0));

	function send(message: ToBackground, stamp: number = state.generation): void {
		lynx.getJSContext().dispatchEvent(encodeToBackground(message, stamp));
	}

	/** The main-thread functions of the page `generation`, whose messages are of that page. */
	function newFunctions(
		scope: { styles: CodeStyles; flattening: Flattening },
		generation: number,
	): FunctionsPage {
		return createFunctionsPage({
			...scope,
			send: (message) => send(message, generation),
			report: (error) => report(error),
			flush: () => {
				if (state.element) mainThread.__FlushElementTree(state.element);
			},
			afterLayout: (run) => calls.afterLayout(run),
			// The main thread has no `queueMicrotask`; a promise's reaction runs at the end of the task.
			soon: (callback) => void Promise.resolve().then(callback),
			nextTurn(callback) {
				lynx.setTimeout(callback, 0);
				return true;
			},
			idOf: (element) => state.applier?.idOf(element),
		});
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

	/** A Lynx event as plain data, with its targets named by the page's ids. */
	const sentEvent = (event: unknown): SentEvent =>
		toSentEvent(event, (uid) => state.applier?.idForUid(uid));

	function onElementEvent(handler: number, event: unknown, input?: number): void {
		try {
			send({ t: "event", handler, event: sentEvent(event), ...(input !== undefined && { input }) });
		} catch (error) {
			report(error);
		}
	}

	function apply(ops: Op[]): void {
		for (const op of ops) if (op[0] === OpCode.Release) cells.drop(op[1]);
		for (const { op, error } of state.applier!.apply(ops)) {
			const reason = error instanceof Error ? error.message : String(error);
			const change = DEV ? describeOp(op) : undefined;
			report(mainThreadError({ code: "change_not_applied", details: { reason, change } }), op);
		}
	}

	const calls = createCalls({
		applier: () => state.applier!,
		functions: () => state.functions,
		report: (error) => report(error),
		// A call's result goes back when the call wants one; a failure that nobody waits for is
		// reported. A result that cannot cross answers with why.
		answer({ id, stamp }, result) {
			if (id === 0) {
				if (!result.ok) report(decodeError(result.error));
				return;
			}
			try {
				send({ t: "reply", id, result }, stamp);
			} catch (error) {
				send({ t: "reply", id, result: { ok: false, error: encodeError(error) } }, stamp);
			}
		},
	});

	const cells = createCells({
		page: state,
		apply,
		send: (message) => send(message),
		report,
		later: (callback) => lynx.setTimeout(callback, 0),
	});

	/** Runs a cell's function refs as Lynx makes the cell, before it flushes it. */
	const settleIn = (functions: FunctionsPage) => (): void =>
		functions.applying(() => functions.settle(), calls.flushed);

	function newApplier(on: LynxElement): Applier {
		return createApplier({
			page: on,
			dispatch: onElementEvent,
			openCell: cells.open,
			scheduleRewrites: cells.schedule,
			written: (id) => state.cells.has(id),
			request: cells.request,
			report,
			styles: state.styles,
			flattening: state.flattening,
			inputs: state.inputs,
			functions: state.functions,
			settle: settleIn(state.functions),
		});
	}

	/** Starts the page over in this patch: what was shown leaves before the patch's flush. */
	function replacePage(): void {
		state.applier!.silence();
		state.previous.push(state.applier!);
		state.applier = newApplier(state.element!);
		// The background lets go of what the page held as it writes it again.
		state.cells.clear();
		state.cellContexts.clear();
		clearPrevious(state);
	}

	/** Whether a rewrite item is the whole page's, the one the main thread writes again; else reported. */
	function isPageRewrite(item: RewriteItem): boolean {
		if (item[1] === ROOT_ID) return true;
		report(mainThreadError({ code: "rewrite_not_page", details: { id: item[1] } }));
		return false;
	}

	/** Applies a patch's items, in order. */
	function applyItems(items: PatchItem[], stamp: number): void {
		for (const item of items) {
			if (state.rewriting) {
				// Until the rewrite, the background's page is written again: only the calls wait for it,
				// and the answers to calls are read.
				if (item[0] === "call") state.held.push({ item, stamp });
				else if (item[0] === "reply") state.functions.reply(item[1], decodeResult(item[2]));
				else if (item[0] === "rewrite") {
					if (isPageRewrite(item)) {
						state.rewriting = false;
						replacePage();
					} else {
						// Not the page the main thread waits for: it asks for the page again.
						send({ t: "rewrite", nodes: [ROOT_ID] });
					}
				}
				continue;
			}
			switch (item[0]) {
				case "ops":
					apply(item[1]);
					break;
				case "cell":
					cells.take(item);
					break;
				case "call":
					calls.run(item, stamp);
					break;
				case "rewrite":
					if (isPageRewrite(item)) replacePage();
					break;
				case "reply":
					state.functions.reply(item[1], decodeResult(item[2]));
					break;
			}
		}
		if (!state.rewriting)
			for (const { item, stamp: page } of state.held.splice(0)) calls.run(item, page);
	}

	/**
	 * Hydrates the first frame with the background's first patch. When it cannot, the frame stays on
	 * the screen and the background is asked to write the page again.
	 */
	function hydrateFrame(patch: Patch): (() => void) | undefined {
		const frame = state.frame!;
		state.frame = undefined;
		const pageApplier = newApplier(state.element!);
		const result = hydrate({
			frame,
			applier: pageApplier,
			items: patch.items,
			count: patch.rendered ?? 0,
			functions: state.functions,
		});
		if (result.kind !== "adopted") {
			state.functions.endFirstFrame(false);
			state.previous.push(frame.applier);
			if (result.kind === "failed") {
				report(result.error);
				state.previous.push(pageApplier);
			}
			state.applier = newApplier(state.element!);
			state.rewriting = true;
			applyItems(patch.items, patch.page);
			send({
				t: "rewrite",
				nodes: [ROOT_ID],
				...(result.kind === "refused" && { mismatch: sentMismatch(result.mismatch, DEV) }),
			});
			return undefined;
		}
		const { hydrated, rendered, propsIds } = result;
		const functions = state.functions;
		// The ids that differed were written over: a development build says where.
		if (DEV && propsIds.length > 0) send({ t: "props-ids", differences: propsIds });
		state.applier = pageApplier;
		for (const [id, parts] of hydrated.cells) state.cells.set(id, parts);
		for (const [id, contexts] of hydrated.cellContexts) state.cellContexts.set(id, contexts);
		pageApplier.resumeWaiting();
		for (const call of hydrated.calls) calls.run(call, patch.page);
		applyItems(patch.items.slice(patch.rendered ?? 0), patch.page);
		return () => {
			replayEarly({
				frame,
				applier: pageApplier,
				rendered,
				ids: hydrated.ids,
				send: (handler, early, at) => {
					const sent = sentEvent(early.event);
					const element = pageApplier.element(at);
					sent.currentTarget = {
						node: at,
						...(element && { uid: mainThread.__GetElementUniqueID(element) }),
					};
					send({
						t: "event",
						handler,
						event: sent,
						...(early.input !== undefined && { input: early.input }),
					});
				},
				call: (held) => functions.sendHeld(held),
			});
			functions.endFirstFrame(true);
		};
	}

	/** Applies a patch of the page it shows, then flushes the tree once. */
	function applyPatch(params: PatchParams): void {
		const patch = decodePatch(params);
		if (DEV) checkMessage(patch, { thread: "main-thread", page: state.generation });
		if (!keepsMessage(patch, state.generation)) return;
		// The new page replaces the old one in the same flush, with no empty frame between.
		if (!state.rewriting) clearPrevious(state);
		let replay: (() => void) | undefined;
		// What main-thread functions change as the patch applies lands in its flush, and the function
		// refs it bound run before it. The patch applies until it is flushed: a cell Lynx asks for in
		// the lists' update or the flush (iOS asks in the update) leaves the patch's reads waiting.
		const functions = state.functions;
		try {
			functions.applying(() => {
				if (state.frame) replay = hydrateFrame(patch);
				else applyItems(patch.items, patch.page);
				if (state.rewriting) return;
				functions.settle();
				state.dataHeld ||= patch.dataUpdated === true;
				// The background's page is shown: a patch of it was applied.
				state.shown = true;
				state.applier!.flushLists();
				const options = state.dataHeld ? { triggerDataUpdated: true } : {};
				state.dataHeld = false;
				mainThread.__FlushElementTree(state.element, options);
			});
			// Waiting for the page written again: nothing of this patch was applied, and its new data
			// is said with the rewrite's flush.
			if (state.rewriting) {
				state.dataHeld ||= patch.dataUpdated === true;
				return;
			}
			calls.flushed();
		} finally {
			// The first frame's log closes even when the flush threw: calls made later go at once.
			replay?.();
		}
	}

	function onPatch(params: PatchParams): void {
		if (state.destroyed) return;
		if (!state.applier || state.painting) {
			state.early.push(params);
			return;
		}
		try {
			applyPatch(params);
		} catch (error) {
			report(error);
		}
	}

	function onRenderPage(event: EngineMessage): void {
		try {
			const page = (state.element = mainThread.__CreatePage("0", 0));
			const functions = state.functions;
			// The engine flushes the tree after the render: the first frame's function refs run before.
			functions.applying(() => {
				state.frame = drawRecordedFrame({
					page,
					data: argsOf(event)[0],
					report,
					styles: state.styles,
					flattening: state.flattening,
					inputs: state.inputs,
					functions,
					settle: settleIn(functions),
				});
				if (state.frame) functions.holdFirstFrame(state.frame.early);
				functions.settle();
			}, calls.flushed);
			if (state.frame) state.applier = state.frame.applier;
			state.applier ??= newApplier(page);
			if (state.frame) {
				// The first frame paints before a patch that came early hydrates it: the patch would
				// hold up the paint by what it costs.
				state.painting = true;
				const generation = state.generation;
				afterFirstPaint(() => {
					if (state.generation !== generation) return;
					state.painting = false;
					for (const params of state.early.splice(0)) onPatch(params);
				});
				return;
			}
			// No flush: the engine flushes the tree after the render.
			for (const params of state.early.splice(0)) applyPatch(params);
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
				state.generation++;
				state.frame?.stop();
				state.frame = undefined;
				// The old page's patches waiting for its paint are dropped, as they would be on arrival.
				state.painting = false;
				state.early.length = 0;
				state.rewriting = false;
				state.held.length = 0;
				state.dataHeld = false;
				state.applier?.silence();
				// The old page's functions run no more; its elements let go of them as they leave.
				state.functions.silence();
				state.functions = newFunctions(state, state.generation);
				if (state.shown || state.previous.length === 0) {
					clearPrevious(state);
					if (state.applier) state.previous.push(state.applier);
				} else {
					// A reload during a reload: the page on screen is still the one before both.
					state.applier?.clear();
				}
				if (state.element) state.applier = newApplier(state.element);
				state.cells.clear();
				state.cellContexts.clear();
				state.shown = false;
			}
			if (state.element) mainThread.__FlushElementTree(state.element, options);
		} catch (error) {
			report(error);
		}
	}

	function onDestroyLifetime(): void {
		try {
			state.generation++;
			state.destroyed = true;
			state.functions.silence();
			engine.removeEventListener("__RenderPage", onRenderPage);
			engine.removeEventListener("__UpdatePage", onUpdatePage);
			native.removeEventListener("__DestroyLifetime", onDestroyLifetime);
			state.frame?.stop();
			state.frame = undefined;
			for (const old of [...state.previous.splice(0), state.applier]) {
				old?.silence();
				old?.destroy();
				old?.clear();
			}
			state.applier = undefined;
			state.early.length = 0;
			state.held.length = 0;
			state.cells.clear();
			state.cellContexts.clear();
		} catch (error) {
			report(error);
		}
	}

	// Main-thread functions: the bodies the page's code registers, the engine's entry to run them, and
	// the calls the page's code makes.
	installRegistry();
	setGlobalFunction(RUN_FUNCTION, (value: unknown, params: unknown, options: unknown) =>
		state.functions.runWorklet(value, params, options),
	);
	functionsGlobal().runtime = {
		runOnBackground: (handle, params) => state.functions.runOnBackground(handle, params),
		runOnMainThread: (fn, params) => state.functions.runOnMainThread(fn, params),
	};

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
		if (state.element)
			mainThread.__FlushElementTree(state.element, isRecord(options) ? options : {});
	});
	setGlobalFunction("getPageData", () => null);
	// The engine runs the page's data through this before each render and update
	// (core/renderer/template_assembler.cc, ProcessTemplateDataForFiber); the page keeps it as is.
	setGlobalFunction("processData", (data: unknown) => data);
	return { page: state };
}
