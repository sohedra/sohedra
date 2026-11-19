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

/** A class instance whose `toJSON` gives an object that holds the instance. */
class Again {
	toJSON() {
		return { again: this };
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

	it.each(Object.keys(cases).filter((name) => name !== "cycle"))(
		"%s: sends the same, at once and later, and is made again for the same changes",
		(name) => {
			expect(compared(run(name, copyCapture))).toEqual(compared(run(name, snapshot)));
		},
	);

	it("cycle: where the snapshot throws, the copy gives what cannot be sent, made again for a change", () => {
		expect(run("cycle", snapshot).error).toBeInstanceOf(RangeError);
		expect(run("cycle", copyCapture)).toEqual({
			first: "throws Error",
			firstSentLater: "throws Error",
			changes: { n: "throws Error" },
			error: undefined,
		});
	});
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
		[
			"a class instance holding an Error named toString",
			new Holder(Object.assign(new Error("m"), { name: "toString" })),
		],
		[
			"a class instance holding an Error named constructor",
			new Holder(Object.assign(new Error("m"), { name: "constructor" })),
		],
		["a class instance holding a boxed number", new Holder(Object(3))],
		[
			"an object with no prototype holding one class instance twice",
			(() => {
				const point = new Point();
				return Object.assign(Object.create(null) as object, { a: point, b: point });
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

/** What writing `value` as text, as the channel does, throws. */
function thrownBySending(value: unknown): unknown {
	try {
		JSON.stringify(value);
	} catch (error) {
		return error;
	}
	throw new Error("The value was written as text.");
}

describe("a capture that cannot be copied", () => {
	it("is sent as a value whose text throws its own error, when it is state that holds itself", () => {
		const tree = cases["cycle"]!().read();
		expect(
			thrownBySending(copyCapture(tree, { name: "tree", where: "src/Tree.svelte:4:2" })),
		).toEqual(
			expect.objectContaining({
				code: "capture_too_deep",
				message: expect.stringMatching(
					/^A main-thread function captures tree, which holds itself or is nested more than 500 levels deep, so it cannot be sent to the main thread\.\nsrc\/Tree\.svelte:4:2\n/,
				),
			}),
		);
		expect(thrownBySending(copyCapture(tree))).toEqual(
			expect.objectContaining({
				message: expect.stringMatching(
					/^A main-thread function captures a value, which holds itself/,
				),
			}),
		);
	});

	it("is sent as a value whose text throws its own error, whenever it holds itself", () => {
		const object: Record<string, unknown> = { n: 1 };
		object["self"] = object;
		const array: unknown[] = [1];
		array.push(array);
		const deep: { a: { b: Record<string, unknown> } } = { a: { b: {} } };
		deep.a.b["up"] = deep;
		const holder = new Holder(null);
		holder.inner = holder;
		const map = new Map<string, unknown>();
		map.set("self", map);
		const held = new Holder(map);
		const json = new Again();
		for (const value of [object, array, deep, holder, held, json])
			expect(
				thrownBySending(copyCapture(value, { name: "tree", where: "src/Tree.svelte:4:2" })),
			).toEqual(
				expect.objectContaining({
					code: "capture_too_deep",
					message: expect.stringMatching(
						/^A main-thread function captures tree, which holds itself/,
					),
				}),
			);
	});

	it("copies a value met twice, but not inside itself, each time", () => {
		const shared = { n: 1 };
		expect(copyCapture({ a: shared, b: [shared] })).toEqual({ a: { n: 1 }, b: [{ n: 1 }] });
		const point = new Point();
		expect(copyCapture(new Holder([point, point]))).toEqual(new Holder([point, point]));
	});

	it("copies a value nested 500 levels deep, and not one level more", () => {
		const nested = (levels: number) => {
			let value: unknown = 1;
			for (let level = 0; level < levels; level++) value = { value };
			return value;
		};
		expect(copyCapture(nested(500))).toEqual(nested(500));
		expect(thrownBySending(copyCapture(nested(501)))).toEqual(
			expect.objectContaining({ code: "capture_too_deep" }),
		);
	});

	it("is sent as a value whose text throws its own error, when it holds an element, anywhere", () => {
		const element = new TreeNode("element");
		element.tag = "view";
		for (const value of [element, { box: element }, [element], new Holder(element)])
			expect(
				thrownBySending(copyCapture(value, { name: "box", where: "src/Box.svelte:3:2" })),
			).toEqual(
				expect.objectContaining({
					code: "element_in_main_thread_function",
					message: expect.stringMatching(
						/^A main-thread function captures box, which holds the <view> element of the background, and an element cannot be sent to the main thread\.\nsrc\/Box\.svelte:3:2\n/,
					),
				}),
			);
	});

	it("never throws, whatever reading it throws: its text throws that instead", () => {
		const thrown = new Error("unreadable");
		const value = {
			get n(): number {
				throw thrown;
			},
		};
		expect(thrownBySending(copyCapture(value))).toBe(thrown);
	});
});

describe("the reason for the copy", () => {
	// A canary: Svelte's snapshot reads the web's EventTarget for every value, and hands most values
	// to structuredClone, and Lynx's engine has neither. When this fails, the snapshot no longer
	// needs them. The copy can go only once the snapshot also stops at a depth a Lynx thread's stack
	// holds: until then, writing $state.snapshot again would lose the copy's two errors and bring
	// back the overflow of a state object that holds itself.
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
