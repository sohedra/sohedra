// What the background's engine lacks, filled in before the page's modules load (start-up.ts). Each
// fill is made only where the engine has none. The language's own gaps are filled only where
// Svelte's runtime needs it: an app gets no fill of the language from the binding.

import type { BackgroundGlobals } from "./globals.ts";

/** Where the fills go. */
export interface FillTargets {
	/** The thread's global object. */
	scope: Record<string, unknown>;
	/** `String.prototype`. */
	strings: object;
	/** The thread's globals, `lynx` read when it is used. */
	globals: BackgroundGlobals;
}

/** Fills in what the background's engine lacks, leaving what it has. */
export function fillEngineGaps(targets: FillTargets): void {
	fillQueueMicrotask(targets);
	fillReplaceAll(targets.strings);
}

/**
 * Svelte schedules its work with the global `queueMicrotask`, which the background lacks.
 * lynx-core's `lynx.queueMicrotask` is the engine's microtask queue itself. The bundle's `Promise`
 * is lynx-core's, which ticks on that same queue in the pages this plugin builds (it turns on
 * `enableMicrotaskPromisePolyfill`; lynx-core's setup-promise.ts): a promise would only add a step
 * in between, and make a throw a rejection.
 *
 * @workaround background-queue-microtask kind=lynx-gap delete-when="Lynx's background thread has a global queueMicrotask"
 */
function fillQueueMicrotask({ scope, globals }: FillTargets): void {
	if (typeof scope["queueMicrotask"] === "function") return;
	scope["queueMicrotask"] = (callback: () => void) => globals.lynx.queueMicrotask(callback);
}

/**
 * Svelte's runtime strips the comments of a `style` attribute with `replaceAll` when the element
 * also has a `style:` directive, and the engine's strings lack it (PrimJS).
 *
 * @workaround string-replace-all kind=lynx-gap delete-when="the engine of the oldest Lynx the binding supports has String.prototype.replaceAll"
 */
function fillReplaceAll(strings: object): void {
	if ("replaceAll" in strings) return;
	Object.defineProperty(strings, "replaceAll", {
		value: replaceAll,
		writable: true,
		configurable: true,
	});
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
