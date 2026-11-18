// UI methods and the flush. The engine makes an element's UI when it flushes the tree, so a UI
// method on an element before that finds none, and it makes none for a layout-only view
// (layout-only.ts). A view that Lynx flattens still has a UI (Android keeps a LynxFlattenUI for it,
// and iOS does not flatten), and answers as any other: on Lynx 4.2, on iOS and Android, a flattened
// view with an id gives `boundingClientRect` code 0 and its box, also right after `flatten` turns
// false. Android's LynxFlattenUI has no `takeScreenshot`, which answers 3 there; the fake leaves
// that to the test's responder, as it models no platform.

import { resolveAtFlush } from "./custom-properties.ts";
import { isLayoutOnly } from "./layout-only.ts";
import { argumentError, stateOf } from "./state.ts";
import type { ElementState, EngineState } from "./state.ts";
import { descendantsOf } from "./tree.ts";
import type { InvokeResult, LynxElement } from "./types.ts";

/** The prefix of an element's filed `global-bindEvent` names. */
const GLOBAL_BIND = "global-bindEvent:";

/** The answer of an element that has no UI: "no UI for this node". */
const NO_UI = 6;

/** The functions that reach the page's UI. */
export interface UiFunctions {
	__InvokeUIMethod(
		element: LynxElement,
		method: string,
		params: Record<string, unknown>,
		callback: (result: InvokeResult) => void,
	): void;
	__FlushElementTree(page?: LynxElement, options?: unknown): void;
}

/** The functions that reach the page's UI, over the engine's records. */
export function uiFunctions(engine: EngineState): UiFunctions {
	return {
		// The UI thread runs the method, and the answer comes back on a later task
		// (core/renderer/template_assembler.cc, LepusInvokeUIMethod). It runs at once, on the view as
		// the last flush left it, since changes reach the view only at the flush
		// (core/renderer/ui_wrapper/painting/ios/painting_context_darwin.mm, Invoke; the Android
		// painting context's Invoke). The fake decides it from the element at the call, and gives the
		// responder the element as the last flush left it.
		__InvokeUIMethod(element, method, params, callback) {
			const state = stateOf(engine, { value: element, fn: "__InvokeUIMethod", index: 0 });
			if (typeof method !== "string")
				throw argumentError({ fn: "__InvokeUIMethod", index: 1, expected: "text" });
			if (typeof params !== "object" || params === null) {
				throw argumentError({ fn: "__InvokeUIMethod", index: 2, expected: "an object" });
			}
			if (typeof callback !== "function")
				throw argumentError({ fn: "__InvokeUIMethod", index: 3, expected: "a function" });
			// No UI before the flush that finds the element in the page, or for a layout-only view.
			const result: InvokeResult = !engine.withUi.has(state)
				? { code: NO_UI }
				: engine.respond(method, params, state.node, engine.shown.get(state));
			engine.log.invocations.push({
				element: state.node,
				method,
				params,
				flushesBefore: engine.log.flushes.length,
				code: result.code,
			});
			const answer = result;
			engine.schedule(() => {
				engine.enter();
				callback(answer);
			});
		},
		// The flush makes the UIs of the elements in the page, except layout-only views, with their
		// changes; one that is not in the page gets none. It also resolves their events: a
		// `global-bindEvent` filed by then puts the element in the global-bind table
		// (core/renderer/dom/element_manager.cc).
		__FlushElementTree(_page, options) {
			engine.log.flushes.push(options);
			const inPage = engine.page ? descendantsOf(engine.page) : [];
			const told = new Set<ElementState>();
			for (const node of inPage) {
				const state = engine.states.get(node);
				if (!state) continue;
				if (!isLayoutOnly(state)) engine.withUi.add(state);
				engine.shown.set(state, {
					classes: state.classes,
					attrs: { ...state.attrs },
					inlineStyles: new Map(state.inlineStyles),
					customProperties: resolveAtFlush(engine, state, told),
				});
				for (const key of state.filedEvents) {
					if (!key.startsWith(GLOBAL_BIND)) continue;
					const names = engine.globalPhase.get(state) ?? new Set<string>();
					names.add(key.slice(GLOBAL_BIND.length));
					engine.globalPhase.set(state, names);
				}
			}
		},
	};
}
