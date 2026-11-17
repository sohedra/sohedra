// Styles set from code. `__SetInlineStyles`, which writes an element's `style` attribute, replaces
// every inline style of the element, those code set one by one with `__AddInlineStyle` too
// (core/runtime/lepus/bindings/renderer_functions.cc, FiberSetInlineStyles). So the properties code
// set are kept here and put back after each write of `style`, except those the write sets itself:
// the write wins, and the property is then the style's. Code that sets a property to `null` or ""
// gives it back to `style`.

import { mainThread } from "./globals.ts";
import type { LynxElement } from "./globals.ts";

/** The styles code set on one page's elements. */
export interface CodeStyles {
	/** Code sets a property of the element's inline style; `null` or "" gives it back to `style`. */
	set(element: LynxElement, styles: Record<string, string | number | null>): void;
	/** `css` was just written as the element's `style`: puts back what code set that it does not. */
	restore(element: LynxElement, css: string): void;
}

/** The names of the properties a `style` text sets. */
function propertiesOf(css: string): Set<string> {
	const names = new Set<string>();
	let start = 0;
	// Parentheses may hold a `;` in a value: `url(data:image/png;base64,…)`.
	let depth = 0;
	for (let i = 0; i <= css.length; i++) {
		const char = i === css.length ? ";" : css[i];
		if (char === "(") depth++;
		else if (char === ")") depth--;
		else if (char === ";" && depth <= 0) {
			const colon = css.indexOf(":", start);
			if (colon !== -1 && colon < i) names.add(propertyKey(css.slice(start, colon).trim()));
			start = i + 1;
			depth = 0;
		}
	}
	return names;
}

const isCustom = (name: string): boolean => name.startsWith("--");

/** A property's name as it is compared: custom properties are case sensitive, others are not. */
const propertyKey = (name: string): string => (isCustom(name) ? name : name.toLowerCase());

/** The code styles of one page. */
export function createCodeStyles(): CodeStyles {
	const kept = new WeakMap<LynxElement, Map<string, string | number>>();
	// Each element's `style` text, as last written: custom properties from code are written with it.
	const written = new WeakMap<LynxElement, string>();

	/**
	 * Writes the element's style with the custom properties code set, then adds the rest.
	 *
	 * @workaround custom-properties-in-style-text kind=lynx-gap delete-when="__AddInlineStyle takes a custom property"
	 */
	function rewrite(element: LynxElement, own: Map<string, string | number>): void {
		let css = written.get(element)?.trim() ?? "";
		for (const [name, value] of own) {
			if (!isCustom(name)) continue;
			if (css !== "" && !css.endsWith(";")) css += ";";
			css += `${name}:${String(value)};`;
		}
		mainThread.__SetInlineStyles(element, css);
		for (const [name, value] of own)
			if (!isCustom(name)) mainThread.__AddInlineStyle(element, name, value);
	}

	return {
		set(element, styles) {
			let own = kept.get(element);
			let custom = false;
			for (const name of Object.keys(styles)) {
				const value = styles[name];
				// A custom property has no style id of its own: it goes in the whole style.
				custom ||= isCustom(name);
				if (value == null || value === "") {
					own?.delete(name);
					if (!isCustom(name)) mainThread.__AddInlineStyle(element, name, null);
					continue;
				}
				if (!own) kept.set(element, (own = new Map()));
				own.set(name, value);
				if (!isCustom(name)) mainThread.__AddInlineStyle(element, name, value);
			}
			if (custom) rewrite(element, own ?? new Map());
		},
		restore(element, css) {
			written.set(element, css);
			const own = kept.get(element);
			if (!own || own.size === 0) return;
			const ownWritten = css === "" ? undefined : propertiesOf(css);
			let custom = false;
			for (const name of own.keys()) {
				if (ownWritten?.has(propertyKey(name))) own.delete(name);
				else custom ||= isCustom(name);
			}
			if (custom) {
				rewrite(element, own);
				return;
			}
			for (const [name, value] of own) mainThread.__AddInlineStyle(element, name, value);
		},
	};
}
