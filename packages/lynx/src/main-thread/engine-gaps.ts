// What the main thread's engine lacks, filled in as its runtime starts, before the page's modules
// load. Each fill is made only where the engine has none, and only for what Svelte's runtime reads
// or the other thread has: an app gets the language's and the web's other APIs from
// `@sohedra/lynx-polyfill`.

import EventTargetFill from "@ungap/event-target";
import { deserialize, serialize } from "@ungap/structured-clone";

import { queueMicrotask } from "./queue-microtask.ts";

/** Where the fills go. */
export interface FillTargets {
	/** The thread's global object. */
	scope: Record<string, unknown>;
	/** `String.prototype`. */
	strings: object;
	/** The thread's `lynx`. */
	lynx: { SystemInfo?: unknown };
}

/** Fills in what the main thread's engine lacks, leaving what it has. */
export function fillEngineGaps(targets: FillTargets): void {
	fillSystemInfo(targets);
	fillReplaceAll(targets.strings);
	fillQueueMicrotask(targets.scope);
	fillEventTarget(targets.scope);
	fillStructuredClone(targets.scope);
}

/**
 * Svelte's `on()` adds a touch, pointer or wheel listener a microtask later when no renderer is
 * current, as on the main thread, with the global `queueMicrotask`, which the main thread lacks: a
 * component's top-level `on(el, "touchstart", …)` threw there at once, and the first frame was not
 * drawn. The build points the script's own uses of the name at the same function; this fill is for
 * code it does not see.
 *
 * @workaround main-thread-queue-microtask kind=lynx-gap delete-when="Lynx's main thread has a global queueMicrotask"
 */
function fillQueueMicrotask(scope: Record<string, unknown>): void {
	if (typeof scope["queueMicrotask"] === "function") return;
	scope["queueMicrotask"] = queueMicrotask;
}

/**
 * The global `SystemInfo`, which the background has and the main thread has only on `lynx`.
 * ReactLynx puts it there too.
 *
 * @workaround main-thread-system-info kind=lynx-gap delete-when="Lynx's main thread has a global SystemInfo"
 */
function fillSystemInfo({ scope, lynx }: FillTargets): void {
	if (scope["SystemInfo"] === undefined && lynx.SystemInfo !== undefined)
		scope["SystemInfo"] = lynx.SystemInfo;
}

/**
 * Svelte's server runtime, which renders the first frame on the main thread, tests values with
 * `instanceof EventTarget` as it copies state with `$state.snapshot`
 * (svelte/src/internal/shared/clone.js). The background has its own fill.
 *
 * @workaround main-thread-event-target kind=lynx-gap delete-when="Lynx's threads have a global EventTarget, or Svelte's clone.js no longer reads it unguarded"
 */
function fillEventTarget(scope: Record<string, unknown>): void {
	if (typeof scope["EventTarget"] !== "function") scope["EventTarget"] = EventTargetFill;
}

/**
 * The same copy, in the first frame, takes each value of state that is not an array, a plain object,
 * a `Map` or a `Set` (a `Date`, a number) through `structuredClone`
 * (svelte/src/internal/shared/clone.js).
 *
 * @workaround main-thread-structured-clone kind=lynx-gap delete-when="Lynx's threads have a global structuredClone, or Svelte's clone.js no longer calls it unguarded"
 */
function fillStructuredClone(scope: Record<string, unknown>): void {
	if (typeof scope["structuredClone"] !== "function") scope["structuredClone"] = cloneStructured;
}

/**
 * `@ungap/structured-clone`'s own copy, with a primitive returned as it is, as the web's
 * `structuredClone` returns it: Svelte copies every number and string of state with it, and
 * `@ungap` serializes each one whole. A symbol or a function still reaches `@ungap`, which refuses
 * it. Its copy is called by name: the package's default export hands the value to a global
 * `structuredClone` when one is there as it loads, which would be this fill wherever the thread
 * has none.
 */
function cloneStructured<T>(value: T, options?: Parameters<typeof serialize>[1]): T {
	const type = typeof value;
	return (type === "object" && value !== null) || type === "function" || type === "symbol"
		? (deserialize(serialize(value, options)) as T)
		: value;
}

/**
 * Svelte's server runtime, which renders the first frame on the main thread, strips the comments of
 * a `style` attribute with `replaceAll` when the element also has a `style:` directive, and the
 * engine's strings lack it (PrimJS). The background has its own fill (background/engine-gaps.ts):
 * the threads share no folder that could hold one for both.
 *
 * @workaround main-thread-string-replace-all kind=lynx-gap delete-when="the engine of the oldest Lynx the binding supports has String.prototype.replaceAll"
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
