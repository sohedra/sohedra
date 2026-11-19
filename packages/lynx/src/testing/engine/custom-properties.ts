// Custom properties in an element's inline style, and what its descendants resolve them to.
//
// The engine keeps a style text unread until the flush resolves the element's style
// (core/renderer/dom/element.cc, Element::SetRawInlineStyles). Reading it there records which
// custom properties changed and marks the descendants that use them, which resolve them again
// (core/renderer/dom/fiber/fiber_element.cc, ProcessFullRawInlineStyle, ParseRawInlineStyles and
// DoFullCSSResolving). A style added one by one before the flush reads the text first, recording
// nothing (Element::SetStyle), so the descendants keep what they resolved before. An object sets
// them at once and marks the descendants then (core/runtime/lepus/bindings/renderer_functions.cc,
// FiberSetInlineStyles). An empty text is never read, so the element keeps its custom properties
// (ProcessFullRawInlineStyle reads only a text that is not empty).

import { parseStyleText } from "./dom.ts";
import type { ElementState, EngineState } from "./state.ts";

const isCustom = (name: string): boolean => name.startsWith("--");

/** Sets the element's custom properties; `marks` if the descendants are told of a change. */
function setVariables(state: ElementState, next: Map<string, string>, marks: boolean): void {
	const before = state.variables;
	const changed =
		before.size !== next.size || [...next].some(([name, value]) => before.get(name) !== value);
	state.variables = next;
	state.styleText = undefined;
	if (marks && changed) state.variablesChanged = true;
}

/** Reads the element's unread style text: the flush does and tells the descendants, a style added one by one does not. */
function readStyleText(state: ElementState, marks: boolean): void {
	if (state.styleText === undefined) return;
	const next = new Map(parseStyleText(state.styleText).filter(([name]) => isCustom(name)));
	setVariables(state, next, marks);
}

/** `__SetInlineStyles` with a text, or with none. */
export function styleTextWritten(state: ElementState, text: string | undefined): void {
	state.styleText = text === undefined || text === "" ? undefined : text;
	state.restyled = true;
}

/** `__SetInlineStyles` with an object. */
export function styleObjectWritten(state: ElementState, styles: Record<string, unknown>): void {
	const next = new Map<string, string>();
	for (const [name, value] of Object.entries(styles))
		if (isCustom(name)) next.set(name, String(value));
	setVariables(state, next, true);
	state.restyled = true;
}

/** `__AddInlineStyle`: reads the style text first, telling no descendant. */
export function styleAdded(state: ElementState): void {
	readStyleText(state, false);
	state.restyled = true;
}

/**
 * At the flush, in the tree's order: the custom properties the element resolves, its own over its
 * parent's. It resolves them again when it is new, when its own style changed, or when it or an
 * element above it told its descendants of a change; else it keeps the last flush's.
 */
export function resolveAtFlush(
	engine: EngineState,
	state: ElementState,
	told: Set<ElementState>,
): ReadonlyMap<string, string> {
	readStyleText(state, true);
	const parent = state.node.parentNode ? engine.states.get(state.node.parentNode) : undefined;
	if (state.variablesChanged || (parent !== undefined && told.has(parent))) told.add(state);
	const before = engine.shown.get(state)?.customProperties;
	const fresh = before === undefined || state.restyled || told.has(state);
	state.variablesChanged = false;
	state.restyled = false;
	if (!fresh) return before;
	const inherited = parent ? engine.shown.get(parent)?.customProperties : undefined;
	return new Map([...(inherited ?? []), ...state.variables]);
}
