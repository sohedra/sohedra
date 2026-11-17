// What an element carries: attributes, classes, id, dataset, inline styles, and the queries over
// it and its descendants. The engine's record keeps each value as it was given, and the DOM element
// shows it.

import {
	attributeText,
	dashed,
	datasetAttribute,
	parseStyleText,
	reflectAttribute,
	reflectStyles,
} from "./dom.ts";
import { receiveListUpdate } from "./lists.ts";
import { select } from "./selectors.ts";
import { argumentError, stateOf } from "./state.ts";
import type { ElementState, EngineState } from "./state.ts";
import { descendantsOf } from "./tree.ts";
import type { LynxElement } from "./types.ts";

/** The functions that set and read what an element carries. */
export interface PropertyFunctions {
	__SetAttribute(element: LynxElement, key: string, value: unknown): void;
	/** `null` for an attribute the element does not have, as Lynx 4.2 answers on iOS and Android. */
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
	): LynxElement | null;
	__QuerySelectorAll(
		element: LynxElement,
		selector: string,
		options: Record<string, unknown>,
	): LynxElement[];
}

/** An attribute's name must be text, and the engine refuses an empty one. */
function checkName(function_: string, index: number, name: unknown): void {
	if (typeof name !== "string" || name === "") {
		throw argumentError({ fn: function_, index: index, expected: "a name that is not empty" });
	}
}

/** The functions that set and read what an element carries, over the engine's records. */
export function propertyFunctions(engine: EngineState): PropertyFunctions {
	function search(options: {
		name: string;
		element: LynxElement;
		selector: string;
		settings: unknown;
		first: boolean;
	}): LynxElement[] {
		const { name, element, selector, settings, first } = options;
		const root = stateOf(engine, { value: element, fn: name, index: 0 });
		if (typeof selector !== "string") throw argumentError({ fn: name, index: 1, expected: "text" });
		if (typeof settings !== "object" || settings === null) {
			throw argumentError({ fn: name, index: 2, expected: "an object" });
		}
		const order = new Map(descendantsOf(root.node).map((node, index) => [node, index]));
		const stateOfNode = (node: Node): ElementState | undefined => engine.states.get(node);
		return select({
			root,
			selector,
			first,
			children: (state) =>
				[...state.node.childNodes]
					.map(stateOfNode)
					.filter((child): child is ElementState => child !== undefined),
			order: (state) => order.get(state.node) ?? 0,
		}).map((state) => state.node);
	}

	return {
		__SetAttribute(element, key, value) {
			const state = stateOf(engine, { value: element, fn: "__SetAttribute", index: 0 });
			checkName("__SetAttribute", 1, key);
			// A list takes its updates as this attribute; they are not an attribute of its own.
			if (key === "update-list-info" && receiveListUpdate(state, value)) return;
			// None takes the attribute away (core/renderer/dom/element.cc, Element::SetAttribute).
			if (value == null) delete state.attrs[key];
			else state.attrs[key] = value;
			reflectAttribute(state, { name: key, value });
		},
		__GetAttributeByName(element, name) {
			const state = stateOf(engine, { value: element, fn: "__GetAttributeByName", index: 0 });
			checkName("__GetAttributeByName", 1, name);
			return state.attrs[name] ?? null;
		},
		__GetAttributeNames: (element) =>
			Object.keys(stateOf(engine, { value: element, fn: "__GetAttributeNames", index: 0 }).attrs),
		// The classes are one text, split at spaces (renderer_functions.cc, FiberSetClasses).
		__SetClasses(element, classes) {
			const state = stateOf(engine, { value: element, fn: "__SetClasses", index: 0 });
			if (typeof classes !== "string")
				throw argumentError({ fn: "__SetClasses", index: 1, expected: "text" });
			state.classes = classes;
			reflectAttribute(state, { name: "class", value: classes === "" ? null : classes });
		},
		// Text sets the id; anything else, an empty one (renderer_functions.cc, FiberSetID). Either
		// way the id is written as an attribute (core/renderer/dom/element.cc,
		// Element::SetIdSelector), so even an id of none gives a view a UI, as on Lynx 4.2 on iOS and
		// Android. The fake takes none for the empty id, and throws for the rest: a number there is a
		// mistake in the page.
		__SetID(element, id) {
			const state = stateOf(engine, { value: element, fn: "__SetID", index: 0 });
			if (id != null && typeof id !== "string") {
				throw argumentError({ fn: "__SetID", index: 1, expected: "text or none" });
			}
			state.id = id ?? "";
			reflectAttribute(state, { name: "id", value: id });
		},
		__SetDataset(element, dataset) {
			const state = stateOf(engine, { value: element, fn: "__SetDataset", index: 0 });
			if (typeof dataset !== "object" || dataset === null || Array.isArray(dataset)) {
				throw argumentError({ fn: "__SetDataset", index: 1, expected: "an object" });
			}
			// Replaces, not merges: the engine sets the dataset it is given (renderer_functions.cc,
			// FiberSetDataset; core/renderer/dom/element.cc, Element::SetDataset).
			for (const key of Object.keys(state.dataset)) {
				reflectAttribute(state, { name: datasetAttribute(key), value: null });
			}
			state.dataset = { ...dataset };
			for (const [key, value] of Object.entries(dataset)) {
				reflectAttribute(state, { name: datasetAttribute(key), value: attributeText(value) });
			}
		},
		__SetInlineStyles(element, styles) {
			const state = stateOf(engine, { value: element, fn: "__SetInlineStyles", index: 0 });
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
				throw argumentError({ fn: "__SetInlineStyles", index: 1, expected: "text or an object" });
			}
			reflectStyles(state);
		},
		__AddInlineStyle(element, key, value) {
			const state = stateOf(engine, { value: element, fn: "__AddInlineStyle", index: 0 });
			// The engine also takes a style's number, which the fake has no table for.
			checkName("__AddInlineStyle", 1, key);
			// The engine looks the name up as it is written, and finds no style for a JavaScript name
			// (FiberAddInlineStyle; core/renderer/css/css_property.cc, GetPropertyID).
			if (!key.startsWith("--") && /[A-Z]/.test(key)) {
				throw new Error(
					`__AddInlineStyle was given ${key}, and Lynx finds no style by that name. ` +
						`Name it as CSS does: ${dashed(key)}.`,
				);
			}
			if (value == null) state.inlineStyles.delete(key);
			else state.inlineStyles.set(key, attributeText(value));
			reflectStyles(state);
		},
		// Inline styles only: the engine answers from the cascade and the layout, which the fake
		// does not have (core/runtime/lepus/bindings/renderer_functions.cc,
		// FiberGetComputedStyleByKey). It reads the computed style at once, and styles are resolved
		// at the flush (core/renderer/dom/element.cc, Element::GetComputedStyleByKey;
		// core/renderer/dom/fiber/fiber_element.cc, ResolveCSSStylesNewPipelineCore): so the fake
		// answers from the inline styles the last flush left.
		__GetComputedStyleByKey(element, key) {
			const state = stateOf(engine, { value: element, fn: "__GetComputedStyleByKey", index: 0 });
			if (typeof key !== "string")
				throw argumentError({ fn: "__GetComputedStyleByKey", index: 1, expected: "text" });
			return engine.shown.get(state)?.inlineStyles.get(key) ?? "";
		},
		// No match answers null, as Lynx 4.2 answers on iOS and Android.
		__QuerySelector: (element, selector, settings) =>
			search({ name: "__QuerySelector", element, selector, settings, first: true })[0] ?? null,
		__QuerySelectorAll: (element, selector, settings) =>
			search({ name: "__QuerySelectorAll", element, selector, settings, first: false }),
	};
}
