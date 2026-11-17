// UI methods and the flush. The engine makes an element's view when it flushes the tree, so a UI
// method on an element before that finds no UI; a flattened element has no view of its own
// either.

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

/**
 * Whether the engine gives the element no view of its own. A plain `<view>` with nothing that
 * needs one is flattened into its parent's drawing (on, as on a device, unless a test turns it
 * off): `flatten="false"` keeps a view
 * (core/renderer/dom/element.cc, Element::CheckFlattenRelatedProp and Element::TendToFlatten).
 * An event handler or a gesture detector also keeps one in what the binding's device probes saw;
 * that is not read off the engine's source, where Element::TendToFlatten asks only for the
 * `attach` and `detach` events (Element::SetEventHandler).
 */
export function isFlattened(engine: EngineState, state: ElementState): boolean {
	return (
		engine.flattening &&
		state.tag === "view" &&
		state.attrs["flatten"] !== false &&
		state.attrs["flatten"] !== "false" &&
		state.listeners.length === 0 &&
		state.mainThreadEvents.length === 0 &&
		state.handlers.length === 0 &&
		state.detectors.size === 0
	);
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
			// No UI before the flush that finds the element in the page; none while it was flattened
			// at the last flush and still is.
			const flattenedThen = engine.flattenedAtFlush.has(state);
			let result: InvokeResult =
				engine.unflushed.has(state) || (flattenedThen && isFlattened(engine, state))
					? { code: NO_UI }
					: engine.respond(method, params, state.node);
			// Flattened at the last flush and given a reason for a view since (`flatten="false"`, a
			// listener, a detector): the engine has not made the view yet and answers as the
			// flattened element it still is, with the right size and the wrong position.
			const data = result.data;
			if (
				flattenedThen &&
				result.code === 0 &&
				typeof data === "object" &&
				data !== null &&
				("left" in data || "top" in data)
			) {
				result = { code: 0, data: { ...data, left: 0, top: 0 } };
			}
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
			engine.flattenedAtFlush.clear();
			const inPage = engine.page ? descendantsOf(engine.page) : [];
			for (const node of inPage) {
				const state = engine.states.get(node);
				if (!state) continue;
				engine.unflushed.delete(state);
				if (isFlattened(engine, state)) engine.flattenedAtFlush.add(state);
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
