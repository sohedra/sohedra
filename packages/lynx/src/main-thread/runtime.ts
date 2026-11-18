// The main thread of a Svelte page. Svelte runs on the background; this side builds Lynx's
// elements, which must happen here. It
//   - makes the page when the engine renders it, draws its first frame (./frame/), and flushes its
//     updates;
//   - hydrates the first frame with the background's first patch (./hydrate/), or asks the
//     background to write the page again when it cannot;
//   - applies each patch the background sends (`callLepusMethod(PATCH_METHOD)`) and flushes the
//     tree once for it;
//   - keeps each list cell's ops as text until the list shows the cell, and asks the background
//     to write cells again (./cells.ts);
//   - answers the calls a patch carries (./calls.ts);
//   - sends the elements' events to the background;
//   - starts the page over when it reloads, and lets go of it when its life ends.

import {
	checkMessage,
	decodeError,
	decodePatch,
	describeOp,
	encodeError,
	encodeToBackground,
	keepsMessage,
	OpCode,
	PATCH_METHOD,
	ROOT_ID,
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
import { fillEngineGaps } from "./engine-gaps.ts";
import { drawRecordedFrame } from "./frame/recorded.ts";
import { DEV, globalScope, mainThread, setGlobalFunction } from "./globals.ts";
import type { EngineMessage, LynxElement } from "./globals.ts";
import { hydrate, replayEarly, sentMismatch } from "./hydrate/hydrate.ts";
import { clearPrevious, createMainThreadPage } from "./page.ts";
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

/**
 * Starts the main thread's runtime: it fills in what the engine lacks, listens to the engine and
 * takes the background's patches.
 */
export function startMainThread(): void {
	const { lynx } = mainThread;
	fillEngineGaps({ scope: globalScope, strings: String.prototype, lynx });
	const engine = lynx.getEngine();
	const native = lynx.getNative();
	const state = createMainThreadPage();

	function send(message: ToBackground, stamp: number = state.generation): void {
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

	/** A Lynx event as plain data, with its targets named by the page's ids. */
	const sentEvent = (event: unknown): SentEvent =>
		toSentEvent(event, (uid) => state.applier?.idForUid(uid));

	function onElementEvent(handler: number, event: unknown): void {
		try {
			send({ t: "event", handler, event: sentEvent(event) });
		} catch (error) {
			report(error);
		}
	}

	function apply(ops: Op[]): void {
		for (const op of ops) if (op[0] === OpCode.Release) state.cells.delete(op[1]);
		for (const { op, error } of state.applier!.apply(ops)) {
			const reason = error instanceof Error ? error.message : String(error);
			const change = DEV ? describeOp(op) : undefined;
			report(mainThreadError({ code: "change_not_applied", details: { reason, change } }), op);
		}
	}

	const calls = createCalls({
		applier: () => state.applier!,
		// A call's result goes back when the call wants one; a failure that nobody waits for is
		// reported.
		answer({ id, stamp }, result) {
			if (id !== 0) send({ t: "reply", id, result }, stamp);
			else if (!result.ok) report(decodeError(result.error));
		},
	});

	const cells = createCells({
		page: state,
		apply,
		send: (message) => send(message),
		report,
		later: (callback) => lynx.setTimeout(callback, 0),
	});

	function newApplier(on: LynxElement): Applier {
		return createApplier({
			page: on,
			dispatch: onElementEvent,
			openCell: cells.open,
			scheduleRewrites: cells.schedule,
			report,
			styles: state.styles,
			flattening: state.flattening,
		});
	}

	/** Starts the page over in this patch: what was shown leaves before the patch's flush. */
	function replacePage(): void {
		state.applier!.silence();
		state.previous.push(state.applier!);
		state.applier = newApplier(state.element!);
		state.cells.clear();
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
				// Until the rewrite, the background's page is written again: only the calls wait for it.
				if (item[0] === "call") state.held.push({ item, stamp });
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
					// The answers to main-thread functions' calls, which their runtime reads.
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
		});
		if (result.kind !== "adopted") {
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
		const { hydrated, rendered } = result;
		state.applier = pageApplier;
		for (const [id, parts] of hydrated.cells) state.cells.set(id, parts);
		for (const call of hydrated.calls) calls.run(call, patch.page);
		applyItems(patch.items.slice(patch.rendered ?? 0), patch.page);
		return () =>
			replayEarly({
				frame,
				applier: pageApplier,
				rendered,
				ids: hydrated.ids,
				send: (handler, event, at) => {
					const sent = sentEvent(event);
					const element = pageApplier.element(at);
					sent.currentTarget = {
						node: at,
						...(element && { uid: mainThread.__GetElementUniqueID(element) }),
					};
					send({ t: "event", handler, event: sent });
				},
			});
	}

	/** Applies a patch of the page it shows, then flushes the tree once. */
	function applyPatch(params: PatchParams): void {
		const patch = decodePatch(params);
		if (DEV) checkMessage(patch, { thread: "main-thread", page: state.generation });
		if (!keepsMessage(patch, state.generation)) return;
		// The new page replaces the old one in the same flush, with no empty frame between.
		if (!state.rewriting) clearPrevious(state);
		let replay: (() => void) | undefined;
		if (state.frame) replay = hydrateFrame(patch);
		else applyItems(patch.items, patch.page);
		const dataUpdated = patch.dataUpdated === true || state.dataHeld;
		// Waiting for the page written again: nothing of this patch was applied.
		if (state.rewriting) {
			state.dataHeld = dataUpdated;
			return;
		}
		state.dataHeld = false;
		// The background's page is shown: a patch of it was applied.
		state.shown = true;
		state.applier!.flushLists();
		mainThread.__FlushElementTree(state.element, dataUpdated ? { triggerDataUpdated: true } : {});
		calls.flushed();
		replay?.();
	}

	function onPatch(params: PatchParams): void {
		if (state.destroyed) return;
		if (!state.applier) {
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
			state.frame = drawRecordedFrame({
				page,
				data: argsOf(event)[0],
				report,
				styles: state.styles,
				flattening: state.flattening,
			});
			if (state.frame) state.applier = state.frame.applier;
			state.applier ??= newApplier(page);
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
				state.rewriting = false;
				state.held.length = 0;
				state.dataHeld = false;
				state.applier?.silence();
				if (state.shown || state.previous.length === 0) {
					clearPrevious(state);
					if (state.applier) state.previous.push(state.applier);
				} else {
					// A reload during a reload: the page on screen is still the one before both.
					state.applier?.clear();
				}
				if (state.element) state.applier = newApplier(state.element);
				state.cells.clear();
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
		if (state.element)
			mainThread.__FlushElementTree(state.element, isRecord(options) ? options : {});
	});
	setGlobalFunction("getPageData", () => null);
	// The engine runs the page's data through this before each render and update
	// (core/renderer/template_assembler.cc, ProcessTemplateDataForFiber); the page keeps it as is.
	setGlobalFunction("processData", (data: unknown) => data);
}
