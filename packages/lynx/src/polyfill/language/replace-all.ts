// `String.prototype.replaceAll`: ECMA-262 § 22.1.3.20. PrimJS's strings lack it.

import { installEager } from "../install.ts";

/**
 * Svelte's runtime strips the comments of a `style` attribute with `replaceAll` when the element
 * also has a `style:` directive, on both threads.
 *
 * @workaround string-replace-all kind=lynx-gap delete-when="the engine of the oldest Lynx the binding supports has String.prototype.replaceAll"
 */
export function fillReplaceAll(strings: object): void {
	installEager(strings, "replaceAll", replaceAll);
}

/** `String.prototype.replaceAll`, as the language specifies it for text and regular expressions. */
function replaceAll(this: string, search: unknown, replacement: unknown): string {
	if (this === null || this === undefined) {
		throw new TypeError("String.prototype.replaceAll called on null or undefined");
	}
	const string = String(this);
	if (search instanceof RegExp) {
		if (!search.flags.includes("g")) {
			throw new TypeError("replaceAll must be called with a global RegExp");
		}
		// Boundary: `replace` takes text or a function, as `replaceAll` does.
		return string.replace(search, replacement as string);
	}
	const needle = String(search);
	const advance = Math.max(1, needle.length);
	let result = "";
	let end = 0;
	let position = string.indexOf(needle);
	while (position !== -1) {
		const replaced =
			typeof replacement === "function"
				? String(replacement(needle, position, string))
				: substitute(String(replacement), { matched: needle, position, string });
		result += string.slice(end, position) + replaced;
		end = position + needle.length;
		const next = position + advance;
		position = next > string.length ? -1 : string.indexOf(needle, next);
	}
	return result + string.slice(end);
}

/** A replacement's `$$`, `$&`, `` $` `` and `$'`, for a match of text (which has no groups). */
function substitute(
	replacement: string,
	match: { matched: string; position: number; string: string },
): string {
	let result = "";
	for (let index = 0; index < replacement.length; index++) {
		const char = replacement[index]!;
		const next = replacement[index + 1];
		if (char !== "$" || next === undefined || !"$&`'".includes(next)) {
			result += char;
			continue;
		}
		if (next === "$") result += "$";
		else if (next === "&") result += match.matched;
		else if (next === "`") result += match.string.slice(0, match.position);
		else result += match.string.slice(match.position + match.matched.length);
		index++;
	}
	return result;
}
