// Text written into generated JavaScript, or into a regular expression.

import { escapeJsonText } from "../wire/index.ts";

/**
 * `text` as a JavaScript string literal. `JSON.stringify` leaves `<`, `>` and the line and paragraph
 * separators as they are; escaping them keeps the literal one line for any engine, and keeps
 * text from a file out of the page's HTML when the script is inlined.
 */
export function stringLiteral(text: string): string {
	return escapeJsonText(JSON.stringify(text));
}

/**
 * `text` as a pattern that matches exactly that text: every character that has a meaning in a
 * regular expression, the backslash included, is escaped.
 */
export function escapeRegExp(text: string): string {
	return text.replace(/[\\^$.*+?()[\]{}|/-]/g, "\\$&");
}
