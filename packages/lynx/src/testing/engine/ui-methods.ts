// UI methods and the flush. The engine makes an element's view when it flushes the tree, so a UI
// method on an element before that finds no UI; a flattened element has no view of its own
// either.

import { argumentError, stateOf } from "./state.ts";
import type { ElementState, EngineState } from "./state.ts";
import type { InvokeResult, LynxElement } from "./types.ts";

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
 * needs one is flattened into its parent's drawing (off unless a test turns it on, as most tests
 * have no use for it): `flatten="false"` keeps a view
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
		state.detectors.size === 0
	);
}

/** The functions that reach the page's UI, over the engine's records. */
export function uiFunctions(engine: EngineState): UiFunctions {
	return {
		// Answers at once; the engine answers on a later task.
		__InvokeUIMethod(element, method, params, callback) {
			const state = stateOf(engine, element, "__InvokeUIMethod", 0);
			if (typeof callback !== "function") throw argumentError("__InvokeUIMethod", 3, "a function");
			let result: InvokeResult =
				engine.unflushed.has(state) || isFlattened(engine, state)
					? { code: NO_UI }
					: engine.respond(method, params, state.node);
			// As the flattened element it still is: right size, wrong position.
			const data = result.data as Record<string, unknown> | null | undefined;
			if (
				engine.stale.has(state) &&
				result.code === 0 &&
				data &&
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
			callback(result);
		},
		__FlushElementTree(_page, options) {
			engine.unflushed.clear();
			engine.stale.clear();
			engine.log.flushes.push(options);
		},
	};
}
