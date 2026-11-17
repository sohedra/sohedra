// The DOM side of an element: what the engine's records show as DOM attributes and text.

import type { ElementState } from "./state.ts";

/** The DOM's `nodeType` of an element. */
export const ELEMENT_NODE = 1;

/** The DOM's `nodeType` of a text node. */
export const TEXT_NODE = 3;

/** The text a value shows as in a DOM attribute: text as is, objects as JSON. */
export function attributeText(value: unknown): string {
	if (typeof value === "string") return value;
	if (typeof value === "object" && value !== null) return JSON.stringify(value);
	return String(value);
}

/** Sets or removes a DOM attribute; a name the DOM refuses is kept by the engine and not shown. */
export function reflectAttribute(state: ElementState, name: string, value: unknown): void {
	const node = state.node;
	if (node.nodeType === TEXT_NODE) {
		// A raw text's `text` is the text node's own text.
		if (name === "text") node.textContent = value == null ? "" : attributeText(value);
		return;
	}
	const element = node as Element;
	try {
		if (value == null) element.removeAttribute(name);
		else element.setAttribute(name, attributeText(value));
	} catch {
		// Boundary: Lynx accepts names the DOM does not, such as one with a space.
	}
}

/** The DOM attribute that shows a dataset key: `drag-handle` is `data-drag-handle`. */
export function datasetAttribute(key: string): string {
	return `data-${key}`;
}

/** Shows the inline styles as the `style` attribute, as text: a DOM style parser would drop values. */
export function reflectStyles(state: ElementState): void {
	if (state.node.nodeType === TEXT_NODE) return;
	const element = state.node as Element;
	if (state.inlineStyles.size === 0) {
		element.removeAttribute("style");
		return;
	}
	const text = [...state.inlineStyles].map(([name, value]) => `${name}: ${value}`).join("; ");
	element.setAttribute("style", text);
}

/**
 * The declarations of a style text, in order: split at the semicolons that are not in brackets
 * or quotes, then at the first colon (a value such as `url(data:image/png;base64,AAA)` has both).
 */
export function parseStyleText(text: string): [string, string][] {
	const declarations: [string, string][] = [];
	let depth = 0;
	let quote = "";
	let start = 0;
	const take = (end: number): void => {
		const declaration = text.slice(start, end);
		const colon = declaration.indexOf(":");
		if (colon > 0) {
			const name = declaration.slice(0, colon).trim();
			const value = declaration.slice(colon + 1).trim();
			if (name !== "") declarations.push([name, value]);
		}
		start = end + 1;
	};
	for (let index = 0; index < text.length; index++) {
		const char = text[index]!;
		if (quote !== "") {
			if (char === quote) quote = "";
		} else if (char === '"' || char === "'") quote = char;
		else if (char === "(") depth++;
		else if (char === ")") depth = Math.max(0, depth - 1);
		else if (char === ";" && depth === 0) take(index);
	}
	take(text.length);
	return declarations;
}

/** `flexDirection` as the engine names it: `flex-direction`; a custom property stays as it is. */
export function dashed(name: string): string {
	return name.startsWith("--")
		? name
		: name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
}
