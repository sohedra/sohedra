// ES2025's iterator helpers, by core-js's modules: ECMA-262 § 27.1 (the `Iterator` global,
// `Iterator.from`, and `drop`, `every`, `filter`, `find`, `flatMap`, `forEach`, `map`, `reduce`,
// `some`, `take` and `toArray` on `Iterator.prototype`). Leaves out nothing. Not in a thread's list:
// a thread's script gets it when its code names them.

import { globalScope } from "../globals.ts";
import { loadIteratorHelpers } from "../vendor/iterator-helpers.js";

/** The methods of `Iterator.prototype` this fills. */
const METHODS = [
	"drop",
	"every",
	"filter",
	"find",
	"flatMap",
	"forEach",
	"map",
	"reduce",
	"some",
	"take",
	"toArray",
] as const;

/**
 * PrimJS lacks them on both threads.
 *
 * @workaround language-iterator-helpers kind=lynx-gap delete-when="the engine of the oldest Lynx the binding supports has ES2025's iterator helpers"
 */
export function fillIteratorHelpers(): void {
	// Boundary: the standard global, which an engine may lack.
	const iterator = globalScope["Iterator"] as
		| ((abstract new () => unknown) & { from?: unknown; prototype: Record<string, unknown> })
		| undefined;
	const has =
		typeof iterator === "function" &&
		typeof iterator.from === "function" &&
		METHODS.every((name) => typeof iterator.prototype[name] === "function");
	if (!has) loadIteratorHelpers();
}
