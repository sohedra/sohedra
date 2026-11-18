// The copy of a main-thread function's captured `$state`: what `$state.snapshot` gives, without the
// web's globals that Lynx's threads lack. Checked against the snapshot itself, which runs here.

import { describe, expect, it } from "@rstest/core";

import { copyCapture } from "../../../../src/background/functions/capture-copy.ts";
import { TreeNode } from "../../../../src/background/renderer/node.ts";
import { cases, run, snapshot } from "../../../fixtures/background/capture-corpus.svelte.ts";
import type { Outcome } from "../../../fixtures/background/capture-corpus.svelte.ts";

/** An outcome, with whether reading threw in place of what it threw. */
const compared = ({ error, ...rest }: Outcome) => ({ ...rest, threw: error !== undefined });

/** What `value` is, and what its `inner` is: which built-in, or a plain object. */
function kinds(value: unknown): string[] {
	const kind = (of: unknown) =>
		typeof of === "object" && of !== null && Object.getPrototypeOf(of) === Object.prototype
			? "plain"
			: Object.prototype.toString.call(of);
	return [kind(value), kind((value as { inner?: unknown }).inner)];
}

/** A class instance that holds a value. */
class Holder {
	inner: unknown;
	constructor(inner: unknown) {
		this.inner = inner;
	}
}

class Point {
	x = 1;
	y = 2;
}

describe("the copy of a capture, against $state.snapshot", () => {
	it("has the whole corpus", () => {
		expect(Object.keys(cases)).toHaveLength(34);
	});

	it.each(Object.keys(cases))(
		"%s: sends the same, at once and later, and is made again for the same changes",
		(name) => {
			expect(compared(run(name, copyCapture))).toEqual(compared(run(name, snapshot)));
		},
	);
});

describe("a value the snapshot hands structuredClone", () => {
	it.each([
		["an object with no prototype", Object.assign(Object.create(null) as object, { n: 1 })],
		["a class instance", new Point()],
		["a class instance holding a class instance", new Holder(new Point())],
		["a class instance holding a Map", new Holder(new Map([[1, 2]]))],
		["a class instance holding a Set", new Holder(new Set([1]))],
		["a class instance holding a Date", new Holder(new Date(5))],
		["a class instance holding a RegExp", new Holder(/x/g)],
		["a class instance holding an Error", new Holder(new TypeError("t"))],
		["a class instance holding a boxed number", new Holder(Object(3))],
		[
			"a class instance holding itself",
			(() => {
				const holder = new Holder(null);
				holder.inner = holder;
				return holder;
			})(),
		],
	])("%s is copied as the built-in or a plain object, as structuredClone does", (_, value) => {
		const copied = copyCapture(value);
		const snapped = snapshot(value);
		expect(copied).not.toBe(value);
		expect(copied).toEqual(snapped);
		expect(kinds(copied)).toEqual(kinds(snapped));
	});

	it("a class instance holding a typed array is copied with a copy of the array", () => {
		// structuredClone makes its typed arrays in this process's own realm, not the test's.
		const value = new Holder(new Uint8Array([1, 2]));
		const copied = copyCapture(value) as Holder;
		expect(kinds(copied)).toEqual(kinds(snapshot(value)));
		expect(copied.inner).not.toBe(value.inner);
		expect([...(copied.inner as Uint8Array)]).toEqual([1, 2]);
	});

	it.each([
		["a function", () => 1],
		["a class instance holding a function", new Holder(() => 1)],
		["a class instance holding a WeakMap", new Holder(new WeakMap())],
		["a class instance holding a promise", new Holder(Promise.resolve())],
		["a class instance holding a symbol", new Holder(Symbol("s"))],
	])("%s, which structuredClone refuses, is kept as it is", (_, value) => {
		expect(copyCapture(value)).toBe(value);
		expect(snapshot(value)).toBe(value);
	});

	it("keeps a class instance that holds a plain object or an array: it may be state, which structuredClone refuses", () => {
		const state = cases["class_holding_proxy"]!().read() as { h: Holder };
		expect(copyCapture(state.h)).toBe(state.h);
		expect(snapshot(state.h)).toBe(state.h);
		// A plain one cannot be told apart from state.
		const plain = new Holder({ n: 1 });
		expect(copyCapture(plain)).toBe(plain);
	});
});

describe("a capture that cannot be copied", () => {
	it("throws its own error when it is state that holds itself", () => {
		const tree = cases["cycle"]!().read();
		expect(() => copyCapture(tree, { name: "tree", where: "src/Tree.svelte:4:2" })).toThrow(
			expect.objectContaining({
				code: "capture_too_deep",
				message: expect.stringMatching(
					/^A main-thread function captures tree, which holds itself or is nested more than 1000 levels deep, so it cannot be copied to the main thread\.\nsrc\/Tree\.svelte:4:2\n/,
				),
			}),
		);
		expect(() => copyCapture(tree)).toThrow(
			expect.objectContaining({
				message: expect.stringMatching(
					/^A main-thread function captures a value, which holds itself/,
				),
			}),
		);
	});

	it("copies a value nested 1000 levels deep, and not one level more", () => {
		const nested = (levels: number) => {
			let value: unknown = 1;
			for (let level = 0; level < levels; level++) value = { value };
			return value;
		};
		expect(copyCapture(nested(1000))).toEqual(nested(1000));
		expect(() => copyCapture(nested(1001))).toThrow(
			expect.objectContaining({ code: "capture_too_deep" }),
		);
	});

	it("throws its own error when it holds an element, anywhere", () => {
		const element = new TreeNode("element");
		element.tag = "view";
		for (const value of [element, { box: element }, [element], new Holder(element)])
			expect(() => copyCapture(value, { name: "box", where: "src/Box.svelte:3:2" })).toThrow(
				expect.objectContaining({
					code: "element_in_main_thread_function",
					message: expect.stringMatching(
						/^A main-thread function captures box, which holds the <view> element of the background, and an element cannot be sent to the main thread\.\nsrc\/Box\.svelte:3:2\n/,
					),
				}),
			);
	});
});

describe("the reason for the copy", () => {
	// A canary: Svelte's snapshot reads the web's EventTarget for every value, and structuredClone
	// for most, and Lynx's threads have neither. When this fails, the snapshot runs there: the
	// capture-copy workaround can go, and the compile step can write $state.snapshot again.
	it("is that $state.snapshot throws without EventTarget and structuredClone, even for a number", () => {
		// Boundary: the test takes the two globals away, as Lynx's threads lack them.
		const scope = globalThis as unknown as Record<string, unknown>;
		const names = ["EventTarget", "structuredClone"];
		const kept = names.map((name) => Object.getOwnPropertyDescriptor(scope, name));
		try {
			for (const name of names) delete scope[name];
			expect(() => snapshot(1)).toThrow(/EventTarget is not defined/);
		} finally {
			names.forEach((name, index) => {
				const descriptor = kept[index];
				if (descriptor) Object.defineProperty(scope, name, descriptor);
			});
		}
	});
});
