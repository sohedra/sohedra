// `structuredClone`: HTML § 2.7 "Safe passing of structured data", by @ungap/structured-clone's own
// copy. Both threads lack it. Leaves out `transfer` and the spec's `DataCloneError` (to come with
// `DOMException`).

import type { Scope } from "../globals.ts";
import { installLazy } from "../install.ts";
import { deserialize, serialize } from "../vendor/structured-clone.js";
import type { SerializeOptions } from "../vendor/structured-clone.js";

/**
 * Svelte's runtime copies each value of state that is not an array, a plain object, a `Map` or a
 * `Set` with it, unguarded (svelte/src/internal/shared/clone.js), on both threads.
 *
 * @workaround web-structured-clone kind=lynx-gap delete-when="Lynx's threads have a global structuredClone"
 */
export function fillStructuredClone(scope: Scope): void {
	installLazy(scope, "structuredClone", () => cloneStructured, isFunction);
}

const isFunction = (existing: unknown): boolean => typeof existing === "function";

/**
 * `@ungap/structured-clone`'s own copy, with a primitive returned as it is, as the web's
 * `structuredClone` returns it: Svelte copies every number and string of state with it, and
 * `@ungap` serializes each one whole. A symbol or a function still reaches `@ungap`, which refuses
 * it. Its copy is called by name: the package's default export hands the value to a global
 * `structuredClone` when one is there as it loads, which would be this fill.
 */
export function cloneStructured<T>(value: T, options?: SerializeOptions): T {
	const type = typeof value;
	return (type === "object" && value !== null) || type === "function" || type === "symbol"
		? // Boundary: a copy of `value`, made again.
			(deserialize(serialize(value, options)) as T)
		: value;
}
