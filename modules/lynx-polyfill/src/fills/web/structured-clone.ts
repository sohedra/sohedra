// `structuredClone`: HTML § 2.7 "Safe passing of structured data", by @ungap/structured-clone's own
// copy, with the spec's `DataCloneError`. Both threads lack it. Leaves out `transfer`. A value
// nested deeper than the engine's stack can copy fails as a `DataCloneError`, not as the engine's
// stack overflow, so untrusted data can't take the thread down.

import type { Scope } from "../globals.ts";
import { holds, installLazy } from "../install.ts";
import { deserialize, serialize } from "../vendor/structured-clone.js";
import type { SerializeOptions } from "../vendor/structured-clone.js";
import { domException } from "./dom-exception.ts";

/**
 * Svelte's runtime copies each value of state that is not an array, a plain object, a `Map` or a
 * `Set` with it, unguarded (svelte/src/internal/shared/clone.js), on both threads.
 *
 * @workaround web-structured-clone kind=lynx-gap delete-when="Lynx's threads have a global structuredClone"
 */
export function fillStructuredClone(scope: Scope): void {
	installLazy(scope, "structuredClone", () => createStructuredClone(scope), refusesAsSpecified);
}

/**
 * A `structuredClone` that refuses a function with a `DataCloneError`, as the standard says: a copy
 * that throws anything else, such as a framework's bare `@ungap/structured-clone`, is replaced.
 */
const refusesAsSpecified = (existing: unknown): boolean =>
	typeof existing === "function" &&
	holds(() => {
		try {
			(existing as (value: unknown) => unknown)(() => {});
			return false;
		} catch (error) {
			return error instanceof Error && error.name === "DataCloneError";
		}
	});

/** The global `structuredClone`: `cloneStructured`, its refusals made `DataCloneError`s. */
export function createStructuredClone(
	scope: Scope,
): <T>(value: T, options?: SerializeOptions) => T {
	return function structuredClone<T>(value: T, options?: SerializeOptions): T {
		const refused = platformObjectIn(
			scope,
			value,
			// Boundary: HTML's `transfer` option, which @ungap's types leave out.
			(options as { transfer?: unknown[] } | undefined)?.transfer ?? [],
		);
		if (refused !== undefined)
			throw domException(
				scope,
				`structuredClone can't copy a ${refused}: it isn't serializable.`,
				"DataCloneError",
			);
		try {
			return cloneStructured(value, options);
		} catch (error) {
			if (error instanceof TypeError)
				throw domException(
					scope,
					`structuredClone can't copy it: ${error.message}.`,
					"DataCloneError",
				);
			if (error instanceof Error && /stack|recursion/i.test(`${error.name} ${error.message}`))
				throw domException(
					scope,
					"structuredClone was given a value nested too deeply to copy.",
					"DataCloneError",
				);
			throw error;
		}
	};
}

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

/** The web's classes whose objects HTML's serialization refuses, which @ungap would copy as plain. */
const NOT_SERIALIZABLE = [
	"URL",
	"URLSearchParams",
	"EventTarget",
	"Event",
	"AbortController",
	"Headers",
	"Request",
	"Response",
	"ReadableStream",
	"WritableStream",
	"TransformStream",
	"TextEncoder",
	"TextDecoder",
	"Performance",
];

/**
 * The class name of the first object in `value` that is a platform object HTML's
 * StructuredSerialize refuses (§ 2.7.3: "Otherwise, if value is a platform object… throw a
 * DataCloneError"), looking through plain objects, arrays, maps and sets; else `undefined`.
 */
function platformObjectIn(
	scope: Scope,
	value: unknown,
	transfer: readonly unknown[],
): string | undefined {
	const classes: [string, Function][] = [];
	for (const name of NOT_SERIALIZABLE) {
		// Boundary: a standard global, which a thread may lack.
		const found = scope[name];
		if (typeof found === "function") classes.push([name, found as Function]);
	}
	const seen = new Set<object>();
	const pending: unknown[] = [value];
	while (pending.length > 0) {
		const next = pending.pop();
		// A transferred object (a `MessagePort`) moves, and is not serialized.
		if (typeof next !== "object" || next === null || seen.has(next) || transfer.includes(next))
			continue;
		seen.add(next);
		for (const [name, Class] of classes) if (holdsInstance(next, Class)) return name;
		if (next instanceof Map) for (const [key, item] of next) pending.push(key, item);
		else if (next instanceof Set) for (const item of next) pending.push(item);
		else if (Array.isArray(next) || Object.getPrototypeOf(next) === Object.prototype)
			for (const key of Object.keys(next)) pending.push((next as Record<string, unknown>)[key]);
	}
	return undefined;
}

/** `value instanceof Class`, without throwing for a class whose `prototype` is odd. */
function holdsInstance(value: object, Class: Function): boolean {
	try {
		return value instanceof Class;
	} catch {
		return false;
	}
}
