// The calls a patch carries: what the background asks of an element (a UI method, a computed
// style, a query), after the ops before them, and of main-thread functions (`runOnMainThread`, and
// the refs the background let go of). Styles set from code and animations are ops.
//
// A main-thread function the background calls runs in place, in the order of the patch's items, so
// what it changes lands in the patch's flush; what it returns goes back once a thenable it returns
// settles, so it can wait for a UI method it calls, which waits for the flush and its layout.
//
// The patch's changes reach the screen at its flush: Lynx makes an element's view then, and a UI
// method runs at once on the view as it is (core/renderer/ui_wrapper/painting, the painting
// contexts' Invoke). A UI method before the flush would answer "no UI for this node" (code 6) for a
// new element, or see the screen from before the update. So reads run after the patch's flush, in
// the order they came: a computed style at once, a UI method once the platform has also laid the
// patch out (`onceLaidOut`). Queries run in place. An element a UI method is called on is held
// from then on, so that Lynx gives it a UI (./flatten.ts).

import { decodeCall, encodeError } from "../wire/index.ts";
import type { CallItem, CallRequest, Result } from "../wire/index.ts";
import type { Applier } from "./apply.ts";
import { mainThreadError } from "./catalogue.ts";
import type { FunctionsPage } from "./functions/page.ts";
import { mainThread } from "./globals.ts";
import type { InvokeResult, LynxElement } from "./globals.ts";

/** Lynx's answer to a UI method on an element with no view: "no UI for this node". */
const NO_UI = 6;

/** What the calls need of the page. */
export interface CallsScope {
	/** The applier of the page being shown. */
	applier(): Applier;
	/** Sends a call's result: its reply, or the report of a failed call that wants none. */
	answer(call: { id: number; stamp: number }, result: Result): void;
	/** The main-thread functions of the page being shown. */
	functions(): FunctionsPage;
	/** Reports what a main-thread function the background called threw, on this thread. */
	report(error: unknown): void;
}

/** The calls of the patches of one page. */
export interface Calls {
	/** Runs a call of the patch being applied, or keeps it until the patch is flushed. */
	run(item: CallItem, stamp: number): void;
	/**
	 * The patch was flushed: runs the computed styles that waited, then, once the platform has laid
	 * the patch out, its UI methods, each kind in order.
	 */
	flushed(): void;
	/** Runs a UI method a main-thread function called with the UI methods of the patch. */
	afterLayout(run: () => void): void;
}

/** A request about an element; the others are for main-thread functions. */
type ElementRequest = Exclude<CallRequest, ["unref", ...unknown[]] | ["run", ...unknown[]]>;

/**
 * Runs `run` once the platform has laid out the last flush: at the second frame after it. Android
 * measures a view's content, such as a scroll view's range, in the frame after a flush, after that
 * frame's callbacks (UIScrollView.measure, from the root view's onMeasure); a UI method run before
 * then reads the content from before the update, and a `scrollTo` past its old end fails.
 *
 * @workaround ui-methods-after-layout kind=lynx-limit delete-when="Lynx runs a UI method after the platform has measured the flush before it"
 */
function onceLaidOut(run: () => void): void {
	mainThread.requestAnimationFrame(() => mainThread.requestAnimationFrame(run));
}

/** What a failed call rejects with. */
const failure = (error: unknown): Result => ({ ok: false, error: encodeError(error) });

/** Whether `value` is a thenable, to be awaited. */
const isThenable = (value: unknown): value is PromiseLike<unknown> =>
	(typeof value === "object" || typeof value === "function") &&
	value !== null &&
	typeof Reflect.get(value, "then") === "function";

/**
 * The calls of one page.
 *
 * @workaround ui-methods-after-flush kind=lynx-limit delete-when="the binding sets the engine's enableElementInvokeUIMethodPendingTask, which runs a UI method after its element's flush"
 */
export function createCalls(scope: CallsScope): Calls {
	const afterFlush: (() => void)[] = [];
	const afterLayout: (() => void)[] = [];

	/** The name of what was called, in the developer's words, for an error. */
	function nameOf(request: ElementRequest): string {
		switch (request[0]) {
			case "invoke":
				return request[1];
			case "computed":
				return "getComputedStyleProperty";
			case "query":
				return "querySelector";
			case "queryAll":
				return "querySelectorAll";
		}
	}

	function invoke(
		element: LynxElement,
		request: { method: string; params: Record<string, unknown> },
		done: (result: Result) => void,
	): void {
		const { method, params } = request;
		mainThread.__InvokeUIMethod(element, method, params, (result: InvokeResult) => {
			if (result.code === 0) done({ ok: true, value: result.data ?? null });
			else if (result.code === NO_UI)
				done(failure(mainThreadError({ code: "element_has_no_view", details: { method } })));
			else
				done(
					failure(
						mainThreadError({ code: "ui_method_failed", details: { method, code: result.code } }),
					),
				);
		});
	}

	/** Runs `request` on the element now; its result goes to `done`. */
	function execute(
		request: ElementRequest,
		element: LynxElement,
		done: (result: Result) => void,
	): void {
		const applier = scope.applier();
		switch (request[0]) {
			case "invoke": {
				const answers = request[3];
				if (answers !== undefined) {
					// A field's value that answers an older `input` event than its latest would undo
					// typing: it is dropped (../inputs.ts).
					if (applier.inputs.stale(element, answers)) {
						done({ ok: true, value: null });
						return;
					}
					applier.inputs.wrote(element, request[2]["value"]);
				}
				invoke(element, { method: request[1], params: request[2] }, done);
				return;
			}
			case "computed":
				done({ ok: true, value: mainThread.__GetComputedStyleByKey(element, request[1]) });
				return;
			case "query": {
				const found = mainThread.__QuerySelector(element, request[1], {});
				done({ ok: true, value: (found && applier.idOf(found)) ?? null });
				return;
			}
			case "queryAll": {
				const ids: number[] = [];
				for (const found of mainThread.__QuerySelectorAll(element, request[1], {})) {
					const id = applier.idOf(found);
					if (id !== undefined) ids.push(id);
				}
				done({ ok: true, value: ids });
				return;
			}
		}
	}

	/**
	 * Runs a main-thread function the background called, and answers with what it returns. What it
	 * throws is reported here; a call that wants no answer reports it with its answer.
	 */
	function runFunction(
		call: { fn: unknown; params: unknown[]; answered: boolean },
		done: (result: Result) => void,
	): void {
		const { fn, params, answered } = call;
		const threw = (error: unknown): void => {
			if (answered) scope.report(error);
			done(failure(error));
		};
		let returned: unknown;
		try {
			returned = scope.functions().run(fn, params);
		} catch (error) {
			threw(error);
			return;
		}
		if (!isThenable(returned)) {
			done({ ok: true, value: returned });
			return;
		}
		Promise.resolve(returned).then((value) => done({ ok: true, value }), threw);
	}

	return {
		afterLayout(run) {
			afterLayout.push(run);
		},
		run(item, stamp) {
			const [, id, elementId, text] = item;
			const done = (result: Result): void => scope.answer({ id, stamp }, result);
			try {
				const request = decodeCall(text);
				if (request[0] === "unref") {
					scope.functions().unref(request[1]);
					return;
				}
				if (request[0] === "run") {
					runFunction({ fn: request[1], params: request[2], answered: id !== 0 }, done);
					return;
				}
				const applier = scope.applier();
				const element = applier.element(elementId);
				if (element === undefined)
					throw mainThreadError({ code: "element_missing", details: { id: elementId } });
				// Held now, so that the patch's flush makes the view the call needs.
				if (request[0] === "invoke") applier.flattening.hold(element);
				if (request[0] !== "invoke" && request[0] !== "computed") {
					execute(request, element, done);
					return;
				}
				(request[0] === "invoke" ? afterLayout : afterFlush).push(() => {
					try {
						if (scope.applier().element(elementId) !== element)
							throw mainThreadError({
								code: "element_left_page",
								details: { method: nameOf(request) },
							});
						execute(request, element, done);
					} catch (error) {
						done(failure(error));
					}
				});
			} catch (error) {
				done(failure(error));
			}
		},
		flushed() {
			for (const run of afterFlush.splice(0)) run();
			const due = afterLayout.splice(0);
			if (due.length > 0)
				onceLaidOut(() => {
					for (const run of due) run();
				});
		},
	};
}
