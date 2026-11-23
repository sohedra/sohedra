// On an engine that has the web's globals and today's language (V8 here; JavaScriptCore runs a
// production iOS app's background), the fills put nothing over a built-in: every global and every
// method they could fill is the same object after as before.

import { describe, expect, it } from "@rstest/core";

import { fillBackground } from "../../../src/polyfill/background.ts";
import { fillMainThread } from "../../../src/polyfill/main-thread.ts";

const TARGETS = { globalThis, "String.prototype": String.prototype };

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
		fillBackground({
			scope: globalThis as unknown as Record<string, unknown>,
			strings: String.prototype,
			readLynx: () => {
				throw new Error("lynx was read");
			},
		});
		expect(changed(before, snapshot())).toEqual([]);
	});

	it("the main thread's fills replace no built-in and add no global", () => {
		const before = snapshot();
		fillMainThread({
			scope: globalThis as unknown as Record<string, unknown>,
			strings: String.prototype,
		});
		expect(changed(before, snapshot())).toEqual([]);
	});
});
