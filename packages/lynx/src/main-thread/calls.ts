// The calls a patch carries: what the background asks of an element (a UI method, a computed
// style, a query), after the ops before them. Styles set from code and animations are ops.
//
// The patch's changes reach the screen at its flush: Lynx makes an element's view then, and a UI
// method runs at once on the view as it is (core/renderer/ui_wrapper/painting, the painting
// contexts' Invoke). A UI method before the flush would answer "no UI for this node" (code 6) for a
// new element, or see the screen from before the update. So reads (a UI method, a computed style)
// run once the patch is flushed, in the order they came; queries run in place. An element a UI
// method is called on is held from then on, so that Lynx gives it a UI (./flatten.ts).

import { decodeCall, encodeError } from "../wire/index.ts";
import type { CallItem, CallRequest, Result } from "../wire/index.ts";
import type { Applier } from "./apply.ts";
import { mainThreadError } from "./catalogue.ts";
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
}

/** The calls of the patches of one page. */
export interface Calls {
	/** Runs a call of the patch being applied, or keeps it until the patch is flushed. */
	run(item: CallItem, stamp: number): void;
	/** The patch was flushed: runs the calls that waited, in order. */
	flushed(): void;
}

/** A request about an element; the others are for main-thread functions. */
type ElementRequest = Exclude<CallRequest, ["unref", ...unknown[]] | ["run", ...unknown[]]>;

/** What a failed call rejects with. */
const failure = (error: unknown): Result => ({ ok: false, error: encodeError(error) });

/**
 * The calls of one page.
 *
 * @workaround ui-methods-after-flush kind=lynx-limit delete-when="the binding sets the engine's enableElementInvokeUIMethodPendingTask, which runs a UI method after its element's flush"
 */
export function createCalls(scope: CallsScope): Calls {
	const waiting: (() => void)[] = [];

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
			case "invoke":
				invoke(element, { method: request[1], params: request[2] }, done);
				return;
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

	return {
		run(item, stamp) {
			const [, id, elementId, text] = item;
			const done = (result: Result): void => scope.answer({ id, stamp }, result);
			try {
				const request = decodeCall(text);
				// Main-thread functions come with their runtime.
				if (request[0] === "unref" || request[0] === "run")
					throw mainThreadError({ code: "call_not_supported", details: { kind: request[0] } });
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
				waiting.push(() => {
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
			for (const run of waiting.splice(0)) run();
		},
	};
}
