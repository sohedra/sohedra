// The engine's tree: elements made, joined and taken apart. Each element is a DOM node, so the
// DOM is the tree.

import { argumentError, elementName, stateOf } from "./state.ts";
import type { ElementState, EngineState } from "./state.ts";
import type { LynxElement } from "./types.ts";

/** The tag whose element is a text node: its `text` attribute is the text. */
const RAW_TEXT = "raw-text";

/** The functions that make and join elements. */
export interface TreeFunctions {
	__CreatePage(componentId: string, cssId: number): LynxElement;
	__GetPageElement(): LynxElement | undefined;
	__GetElementUniqueID(element: LynxElement): number;
	__CreateView(parentComponentUniqueId: number): LynxElement;
	__CreateText(parentComponentUniqueId: number): LynxElement;
	__CreateImage(parentComponentUniqueId: number): LynxElement;
	__CreateScrollView(parentComponentUniqueId: number): LynxElement;
	__CreateElement(tag: string, parentComponentUniqueId: number): LynxElement;
	__AppendElement(parent: LynxElement, child: LynxElement): void;
	__InsertElementBefore(
		parent: LynxElement,
		child: LynxElement,
		reference: LynxElement | null | undefined,
	): void;
	__RemoveElement(parent: LynxElement, child: LynxElement): void;
}

/** Makes an element of `tag`, numbered and kept by the engine. */
export function makeElement(engine: EngineState, tag: string): ElementState {
	const node: LynxElement =
		tag === RAW_TEXT ? engine.document.createTextNode("") : engine.document.createElement(tag);
	const state: ElementState = {
		uid: engine.nextUid++,
		tag,
		node,
		attrs: {},
		classes: "",
		id: null,
		dataset: {},
		inlineStyles: new Map(),
		listeners: [],
		mainThreadEvents: [],
		handlers: [],
		filedEvents: new Set(),
		detectors: new Map(),
		running: new Map(),
	};
	engine.states.set(node, state);
	engine.made.set(state.uid, state);
	engine.unflushed.add(state);
	return state;
}

/** Every create function is given the number of the component it is made for. */
function checkParentNumber(name: string, value: unknown): void {
	if (typeof value !== "number") throw argumentError({ fn: name, index: 0, expected: "a number" });
}

/** Every element of the tree under `root`, `root` first, as its DOM nodes are ordered. */
export function descendantsOf(root: LynxElement): LynxElement[] {
	const found: LynxElement[] = [root];
	// Boundary: the engine puts only its elements and text nodes in its tree.
	for (const child of root.childNodes) found.push(...descendantsOf(child as LynxElement));
	return found;
}

/** The functions that make and join elements, over the engine's records. */
export function treeFunctions(engine: EngineState): TreeFunctions {
	const created = (name: string, parent: unknown, tag: string): LynxElement => {
		checkParentNumber(name, parent);
		return makeElement(engine, tag).node;
	};

	/** Puts `child`, which must be free, in `parent` before `reference`, or at the end. */
	function join(
		name: string,
		parent: ElementState,
		child: ElementState,
		reference: ElementState | undefined,
	): void {
		// Lynx logs "re-insert node" and moves it (core/renderer/dom/fiber/fiber_element.cc,
		// Element::InsertNodeBeforeInternal); the fake throws, as the page lost track of it.
		if (child.node.parentNode) {
			const holder = engine.states.get(child.node.parentNode);
			throw new Error(
				`${name} was given a <${child.tag}> that is still in a <${holder?.tag ?? "container"}>. ` +
					"Lynx logs an error and moves it; remove it from its parent first.",
			);
		}
		parent.node.insertBefore(child.node, reference?.node ?? null);
	}

	return {
		__CreatePage(componentId, cssId) {
			if (typeof componentId !== "string")
				throw argumentError({ fn: "__CreatePage", index: 0, expected: "a string" });
			if (typeof cssId !== "number")
				throw argumentError({ fn: "__CreatePage", index: 1, expected: "a number" });
			engine.page?.parentNode?.removeChild(engine.page);
			const page = makeElement(engine, "page").node;
			engine.container.appendChild(page);
			engine.page = page;
			return page;
		},
		__GetPageElement: () => engine.page,
		__GetElementUniqueID: (element) =>
			stateOf(engine, { value: element, fn: "__GetElementUniqueID", index: 0 }).uid,
		__CreateView: (parent) => created("__CreateView", parent, "view"),
		__CreateText: (parent) => created("__CreateText", parent, "text"),
		__CreateImage: (parent) => created("__CreateImage", parent, "image"),
		__CreateScrollView: (parent) => created("__CreateScrollView", parent, "scroll-view"),
		__CreateElement(tag, parent) {
			if (typeof tag !== "string" || tag === "") {
				throw argumentError({ fn: "__CreateElement", index: 0, expected: "a tag name" });
			}
			return created("__CreateElement", parent, tag);
		},
		__AppendElement(parent, child) {
			join(
				"__AppendElement",
				stateOf(engine, { value: parent, fn: "__AppendElement", index: 0 }),
				stateOf(engine, { value: child, fn: "__AppendElement", index: 1 }),
				undefined,
			);
		},
		__InsertElementBefore(parent, child, reference) {
			const holder = stateOf(engine, { value: parent, fn: "__InsertElementBefore", index: 0 });
			const inserted = stateOf(engine, { value: child, fn: "__InsertElementBefore", index: 1 });
			// The engine appends when the reference is not an element (renderer_functions.cc,
			// FiberInsertElementBefore), and logs and drops the insert when it is not a child
			// (fiber_element.cc, Element::InsertNodeBeforeInternal).
			const before =
				reference == null
					? undefined
					: stateOf(engine, { value: reference, fn: "__InsertElementBefore", index: 2 });
			if (before && before.node.parentNode !== holder.node) {
				throw new Error(
					"__InsertElementBefore was given a reference that is not in the parent. " +
						"Lynx logs an error and drops the insert.",
				);
			}
			join("__InsertElementBefore", holder, inserted, before);
		},
		__RemoveElement(parent, child) {
			const holder = stateOf(engine, { value: parent, fn: "__RemoveElement", index: 0 });
			const removed = stateOf(engine, { value: child, fn: "__RemoveElement", index: 1 });
			// Lynx logs and drops it (fiber_element.cc, Element::RemoveNodeInternal).
			if (removed.node.parentNode !== holder.node) {
				throw new Error(
					`__RemoveElement was given a child that is not in the parent (${elementName(removed)}). ` +
						"Lynx logs an error and drops the removal.",
				);
			}
			holder.node.removeChild(removed.node);
		},
	};
}
