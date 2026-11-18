// An attribute's value as the main thread gets it.

import type { AttrValue } from "../../wire/index.ts";

/** Whether an attribute's value is a function: a handler, never sent to the main thread. */
export const isFunction = (value: unknown): value is (event: unknown) => unknown =>
	typeof value === "function";

/**
 * `value` as text, as an attribute's text is read: a string as it is, a number, a boolean or a
 * BigInt written out, anything else as its JSON.
 */
export function textOf(value: unknown): string {
	if (typeof value === "string") return value;
	if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint")
		return value.toString();
	try {
		return JSON.stringify(value) ?? "";
	} catch {
		return "";
	}
}

/** A style object (`style={{ color: "red" }}`) as the text of a `style` attribute. */
function styleText(style: Record<string, unknown>): string {
	let out = "";
	for (const key in style) {
		const value = style[key];
		if (value == null || value === "") continue;
		out += `${key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}:${textOf(value)};`;
	}
	return out;
}

/**
 * `value` as an op carries it. Objects and arrays stay values, which Lynx reads as such
 * (`accessibility-actions`, an object `data-*`); `String()` would make `[object Object]`. A
 * function is never sent, as its source text or otherwise.
 */
export function attrValue(key: string, value: unknown): AttrValue {
	if (value == null || typeof value === "function") return null;
	if (typeof value === "string" || typeof value === "number" || typeof value === "boolean")
		return value;
	if (typeof value === "object") {
		// Boundary: a style object's values are read by key.
		if (key === "style") return styleText(value as Record<string, unknown>);
		return value;
	}
	return textOf(value);
}
