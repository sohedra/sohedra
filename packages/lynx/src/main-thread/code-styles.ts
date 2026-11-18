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
	/** Writes `css` as the element's `style`, and puts back what code set that it does not. */
	write(element: LynxElement, css: string): void;
}

const isCustom = (name: string): boolean => name.startsWith("--");

/** A property's name as it is compared: custom properties are case sensitive, others are not. */
const propertyKey = (name: string): string => (isCustom(name) ? name : name.toLowerCase());

/** The declarations of a `style` text, by name as compared; a later one wins. */
function declarationsOf(css: string): Map<string, string> {
	const declarations = new Map<string, string>();
	let start = 0;
	// Parentheses may hold a `;` in a value: `url(data:image/png;base64,…)`.
	let depth = 0;
	for (let i = 0; i <= css.length; i++) {
		const char = i === css.length ? ";" : css[i];
		if (char === "(") depth++;
		else if (char === ")") depth--;
		else if (char === ";" && depth <= 0) {
			const colon = css.indexOf(":", start);
			if (colon !== -1 && colon < i) {
				const name = propertyKey(css.slice(start, colon).trim());
				declarations.set(name, css.slice(colon + 1, i).trim());
			}
			start = i + 1;
			depth = 0;
		}
	}
	return declarations;
}

/** The code styles of one page. */
export function createCodeStyles(): CodeStyles {
	const kept = new WeakMap<LynxElement, Map<string, string | number>>();
	// Each element's `style` text, as last written: custom properties from code are written with it.
	const written = new WeakMap<LynxElement, string>();
	// The elements whose style text has held a custom property.
	const withCustom = new WeakSet<LynxElement>();

	/**
	 * Writes the element's style with the custom properties code set, then adds the rest. Lynx tells
	 * the children of a custom property's change only when it reads the style text at the flush. A
	 * style added one by one reads it before, and an empty text is never read; either way the
	 * children keep the old value (core/renderer/dom/fiber/fiber_element.cc,
	 * ParseRawInlineStyles; core/renderer/dom/element.cc, Element::SetStyle). So, once the style
	 * has held one, the custom properties are first set as an object, which tells the children.
	 *
	 * @workaround custom-properties-in-style-text kind=lynx-gap delete-when="__AddInlineStyle takes a custom property, and Lynx tells the children of a change in the style text whenever it reads it"
	 */
	function rewrite(element: LynxElement): void {
		let css = written.get(element)?.trim() ?? "";
		const rest: [string, string | number][] = [];
		for (const [name, value] of kept.get(element) ?? []) {
			if (!isCustom(name)) {
				rest.push([name, value]);
				continue;
			}
			if (css !== "" && !css.endsWith(";")) css += ";";
			css += `${name}:${String(value)};`;
		}
		const custom: Record<string, string> = {};
		for (const [name, value] of declarationsOf(css)) if (isCustom(name)) custom[name] = value;
		const held = withCustom.has(element) || Object.keys(custom).length > 0;
		if (held) withCustom.add(element);
		if (held && (rest.length > 0 || css === "")) mainThread.__SetInlineStyles(element, custom);
		mainThread.__SetInlineStyles(element, css);
		for (const [name, value] of rest) mainThread.__AddInlineStyle(element, name, value);
	}

	return {
		set(element, styles) {
			let own = kept.get(element);
			// A custom property has no style id of its own: it goes in the whole style.
			let whole = withCustom.has(element);
			for (const name of Object.keys(styles)) {
				const value = styles[name];
				whole ||= isCustom(name);
				if (value == null || value === "") {
					own?.delete(name);
					continue;
				}
				if (!own) kept.set(element, (own = new Map()));
				own.set(name, value);
			}
			if (whole) {
				rewrite(element);
				return;
			}
			for (const name of Object.keys(styles)) {
				const value = styles[name];
				mainThread.__AddInlineStyle(element, name, value == null || value === "" ? null : value);
			}
		},
		write(element, css) {
			written.set(element, css);
			const own = kept.get(element);
			if (own && own.size > 0) {
				const ownWritten = declarationsOf(css);
				for (const name of own.keys()) if (ownWritten.has(propertyKey(name))) own.delete(name);
			}
			if ((own === undefined || own.size === 0) && !withCustom.has(element)) {
				if (css.includes("--")) withCustom.add(element);
				mainThread.__SetInlineStyles(element, css);
				return;
			}
			rewrite(element);
		},
	};
}
