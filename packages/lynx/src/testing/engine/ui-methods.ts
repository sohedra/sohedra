// UI methods and the flush. The engine makes an element's UI when it flushes the tree, so a UI
// method on an element before that finds none. A plain view that Lynx flattens still has a UI
// (Android keeps a LynxFlattenUI for it), and answers as any other: on Lynx 4.2, on iOS and
// Android, `boundingClientRect` gives code 0 and its box, also right after `flatten` turns false.
// Whether every other method answers so on a flattened view was not checked on a device.

import { argumentError, stateOf } from "./state.ts";
import type { EngineState } from "./state.ts";
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
		// (core/renderer/template_assembler.cc, LepusInvokeUIMethod). The fake decides it from the
		// element as it is at the call.
		__InvokeUIMethod(element, method, params, callback) {
			const state = stateOf(engine, { value: element, fn: "__InvokeUIMethod", index: 0 });
			if (typeof method !== "string")
				throw argumentError({ fn: "__InvokeUIMethod", index: 1, expected: "text" });
			if (typeof params !== "object" || params === null) {
				throw argumentError({ fn: "__InvokeUIMethod", index: 2, expected: "an object" });
			}
			if (typeof callback !== "function")
				throw argumentError({ fn: "__InvokeUIMethod", index: 3, expected: "a function" });
			// No UI before the flush that finds the element in the page.
			const result: InvokeResult = engine.unflushed.has(state)
				? { code: NO_UI }
				: engine.respond(method, params, state.node);
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
		// The flush makes the views of the elements in the page; one that is not in the page gets
		// none. It also resolves their events: a `global-bindEvent` filed by then puts the element
		// in the global-bind table (core/renderer/dom/element_manager.cc).
		__FlushElementTree(_page, options) {
			engine.log.flushes.push(options);
			const inPage = engine.page ? descendantsOf(engine.page) : [];
			for (const node of inPage) {
				const state = engine.states.get(node);
				if (!state) continue;
				engine.unflushed.delete(state);
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
