// On an engine that has the web's globals and today's language (V8 here; JavaScriptCore runs a
// production iOS app's background), the fills put nothing over a built-in: every global and every
// method they could fill is the same object after as before. The heavy language fills, which a
// thread gets only when its code names them, too.

import { describe, expect, it } from "@rstest/core";

import { fillBackground } from "../../../src/polyfill/background.ts";
import { fillFloat16 } from "../../../src/polyfill/language/float16.ts";
import { fillIteratorHelpers } from "../../../src/polyfill/language/iterator-helpers.ts";
import { fillNormalize } from "../../../src/polyfill/language/normalize.ts";
import { fillSetMethods } from "../../../src/polyfill/language/set-methods.ts";
import { fillMainThread } from "../../../src/polyfill/main-thread.ts";

// Boundary: ES2025's `Iterator`, which this package's types leave out.
const ITERATOR = (globalThis as unknown as { Iterator: { prototype: object } }).Iterator;

/** Every object a fill puts something on. */
const TARGETS: Record<string, object> = {
	globalThis,
	Object,
	Array,
	"Array.prototype": Array.prototype,
	"%TypedArray%.prototype": Object.getPrototypeOf(Int8Array.prototype) as object,
	String: String,
	"String.prototype": String.prototype,
	Promise,
	Reflect,
	RegExp,
	Map,
	"Set.prototype": Set.prototype,
	Math,
	"DataView.prototype": DataView.prototype,
	BigInt,
	Iterator: ITERATOR,
	"Iterator.prototype": ITERATOR.prototype,
	JSON,
};

/** Every own property of each target, by name, as what it holds: its value, or its accessors. */
function snapshot(): Map<string, unknown[]> {
	const held = new Map<string, unknown[]>();
	for (const [owner, target] of Object.entries(TARGETS)) {
		for (const key of Reflect.ownKeys(target)) {
			const descriptor = Object.getOwnPropertyDescriptor(target, key)!;
			held.set(`${owner}.${String(key)}`, [descriptor.value, descriptor.get, descriptor.set]);
		}
	}
	return held;
}

/** The properties that are not the same objects in `after` as in `before`. */
function changed(before: Map<string, unknown[]>, after: Map<string, unknown[]>): string[] {
	const names = new Set([...before.keys(), ...after.keys()]);
	return [...names].filter((name) => {
		const [was, is] = [before.get(name), after.get(name)];
		return !was || !is || was.some((held, index) => !Object.is(held, is[index]));
	});
}

describe("on an engine that has them", () => {
	it("the background's fills replace no built-in and add no global", () => {
		const before = snapshot();
		const lynx = { Promise, reportError: () => {} };
		fillBackground({
			scope: globalThis as unknown as Record<string, unknown>,
			readLynx: () => lynx,
		});
		expect(changed(before, snapshot())).toEqual([]);
	});

	it("the main thread's fills replace no built-in and add no global", () => {
		const before = snapshot();
		fillMainThread({ scope: globalThis as unknown as Record<string, unknown> });
		expect(changed(before, snapshot())).toEqual([]);
	});

	it("the heavy language fills replace no built-in", () => {
		const before = snapshot();
		fillIteratorHelpers();
		fillSetMethods();
		fillFloat16();
		fillNormalize();
		expect(changed(before, snapshot())).toEqual([]);
	});

	it("core-js keeps no store on the global object: none of its modules loaded", () => {
		fillBackground({
			scope: globalThis as unknown as Record<string, unknown>,
			readLynx: () => ({ Promise, reportError: () => {} }),
		});
		expect(Object.hasOwn(globalThis, "__core-js_shared__")).toBe(false);
	});
});
