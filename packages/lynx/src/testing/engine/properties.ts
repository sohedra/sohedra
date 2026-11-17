// What an element carries: attributes, classes, id, dataset, inline styles, and the queries over
// its descendants. The engine's record keeps each value as it was given, and the DOM element
// shows it.

import {
	ELEMENT_NODE,
	attributeText,
	dashed,
	datasetAttribute,
	parseStyleText,
	reflectAttribute,
	reflectStyles,
} from "./dom.ts";
import { argumentError, stateOf } from "./state.ts";
import type { EngineState } from "./state.ts";
import type { LynxElement } from "./types.ts";

/** The functions that set and read what an element carries. */
export interface PropertyFunctions {
	__SetAttribute(element: LynxElement, key: string, value: unknown): void;
	__GetAttributeByName(element: LynxElement, name: string): unknown;
	__GetAttributeNames(element: LynxElement): string[];
	__SetClasses(element: LynxElement, classes: string): void;
	__SetID(element: LynxElement, id: string | null): void;
	__SetDataset(element: LynxElement, dataset: Record<string, unknown>): void;
	__SetInlineStyles(
		element: LynxElement,
		styles: string | Record<string, unknown> | undefined,
	): void;
	__AddInlineStyle(
		element: LynxElement,
		key: string,
		value: string | number | null | undefined,
	): void;
	__GetComputedStyleByKey(element: LynxElement, key: string): string;
	__QuerySelector(
		element: LynxElement,
		selector: string,
		options: Record<string, unknown>,
	): LynxElement | undefined;
	__QuerySelectorAll(
		element: LynxElement,
		selector: string,
		options: Record<string, unknown>,
	): LynxElement[];
}

/** An attribute's name must be text, and the engine refuses an empty one. */
function checkName(function_: string, index: number, name: unknown): void {
	if (typeof name !== "string" || name === "") {
		throw argumentError(function_, index, "a name that is not empty");
	}
}

/** The functions that set and read what an element carries, over the engine's records. */
export function propertyFunctions(engine: EngineState): PropertyFunctions {
	function search(
		name: string,
		element: LynxElement,
		selector: string,
		options: unknown,
	): Element[] {
		const state = stateOf(engine, element, name, 0);
		if (typeof selector !== "string") throw argumentError(name, 1, "text");
		if (typeof options !== "object" || options === null) {
			throw argumentError(name, 2, "an object");
		}
		return state.node.nodeType === ELEMENT_NODE
			? [...(state.node as Element).querySelectorAll(selector)]
			: [];
	}

	return {
		__SetAttribute(element, key, value) {
			const state = stateOf(engine, element, "__SetAttribute", 0);
			checkName("__SetAttribute", 1, key);
			if (value == null) delete state.attrs[key];
			else state.attrs[key] = value;
			reflectAttribute(state, key, value);
		},
		__GetAttributeByName(element, name) {
			const state = stateOf(engine, element, "__GetAttributeByName", 0);
			checkName("__GetAttributeByName", 1, name);
			return state.attrs[name];
		},
		__GetAttributeNames: (element) =>
			Object.keys(stateOf(engine, element, "__GetAttributeNames", 0).attrs),
		__SetClasses(element, classes) {
			const state = stateOf(engine, element, "__SetClasses", 0);
			state.classes = classes;
			reflectAttribute(state, "class", classes === "" ? null : classes);
		},
		__SetID(element, id) {
			const state = stateOf(engine, element, "__SetID", 0);
			state.id = id;
			reflectAttribute(state, "id", id);
		},
		__SetDataset(element, dataset) {
			const state = stateOf(engine, element, "__SetDataset", 0);
			// Replaces, not merges: the engine sets the dataset it is given.
			for (const key of Object.keys(state.dataset)) {
				reflectAttribute(state, datasetAttribute(key), null);
			}
			state.dataset = { ...dataset };
			for (const [key, value] of Object.entries(dataset)) {
				reflectAttribute(state, datasetAttribute(key), attributeText(value));
			}
		},
		__SetInlineStyles(element, styles) {
			const state = stateOf(engine, element, "__SetInlineStyles", 0);
			// Replaces every inline style, those added one by one (`__AddInlineStyle`) too
			// (core/runtime/lepus/bindings/renderer_functions.cc, FiberSetInlineStyles:
			// `RemoveAllInlineStyles` first, which empties the map `SetStyle` writes to).
			state.inlineStyles.clear();
			if (typeof styles === "string") {
				for (const [name, value] of parseStyleText(styles)) state.inlineStyles.set(name, value);
			} else if (typeof styles === "object" && styles !== null) {
				for (const [name, value] of Object.entries(styles)) {
					state.inlineStyles.set(dashed(name), attributeText(value));
				}
			} else if (styles !== undefined) {
				throw argumentError("__SetInlineStyles", 1, "text or an object");
			}
			reflectStyles(state);
		},
		__AddInlineStyle(element, key, value) {
			const state = stateOf(engine, element, "__AddInlineStyle", 0);
			checkName("__AddInlineStyle", 1, key);
			if (value == null) state.inlineStyles.delete(key);
			else state.inlineStyles.set(key, attributeText(value));
			reflectStyles(state);
		},
		// Inline styles only: the engine answers from the cascade and the layout, which the fake
		// does not have (core/runtime/lepus/bindings/renderer_functions.cc,
		// FiberGetComputedStyleByKey).
		__GetComputedStyleByKey(element, key) {
			const state = stateOf(engine, element, "__GetComputedStyleByKey", 0);
			return state.inlineStyles.get(key) ?? "";
		},
		__QuerySelector: (element, selector, options) =>
			search("__QuerySelector", element, selector, options)[0],
		__QuerySelectorAll: (element, selector, options) =>
			search("__QuerySelectorAll", element, selector, options),
	};
}
