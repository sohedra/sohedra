// Object values: Controllable keeps the very object it was given (never a deep proxy), and an
// object written through a user's `$state` binding, which proxies it, still reads as the object.
import { flushSync } from "svelte";
import { describe, expect, it, vi } from "vitest";

import { Controllable, type ControllableSource } from "../../../src/foundation/kernel/index.js";

type Option = { id: string };
const A: Option = { id: "a" };
const B: Option = { id: "b" };

const details = () => ({ isCanceled: false });
const options = (fallback: Option | undefined) => ({
	default: () => fallback,
	name: "Test",
	state: "value",
});

/** A binding to a user's `$state`, which proxies an object assigned to it. */
function stateSource(initial: Option | undefined) {
	let value = $state(initial);
	return {
		get value() {
			return value;
		},
		set value(next) {
			value = next;
		},
	} satisfies ControllableSource<Option | undefined>;
}

describe("Controllable with object values", () => {
	it("keeps an uncontrolled object as given", () => {
		// No binding: the source stays unset, so the value is the store's own.
		const unset: ControllableSource<Option | undefined> = {
			get value() {
				return undefined;
			},
			set value(_next) {},
		};
		const value = new Controllable<Option | undefined>(unset, options(A));
		expect(value.current).toBe(A);
		expect(value.set(B, details())).toBe(true);
		expect(value.current).toBe(B);
	});

	it("reads an object written through a proxying binding as the object", () => {
		const source = stateSource(undefined);
		const value = new Controllable<Option | undefined>(source, options(A));
		expect(source.value).not.toBe(A);
		expect(value.current).toBe(A);

		expect(value.set(B, details())).toBe(true);
		expect(source.value).not.toBe(B);
		expect(source.value).toEqual(B);
		expect(value.current).toBe(B);
	});

	it("follows the binding once the parent sets another value", () => {
		const source = stateSource(undefined);
		const value = new Controllable<Option | undefined>(source, options(A));
		source.value = { id: "c" };
		expect(value.current).toEqual({ id: "c" });
		expect(value.current).not.toBe(A);
	});

	it("still sees a declining binding keep its value", () => {
		const set = vi.fn();
		const source: ControllableSource<Option> = {
			get value() {
				return A;
			},
			set value(next) {
				set(next);
			},
		};
		const value = new Controllable<Option>(source, {
			default: () => A,
			name: "Test",
			state: "value",
		});
		expect(value.set(B, details())).toBe(false);
		expect(value.current).toBe(A);
	});
});

/** A binding to a user's `$state` array, which proxies an array assigned to it. */
function arraySource(initial: unknown[] | undefined) {
	let value = $state(initial);
	return {
		get value() {
			return value;
		},
		set value(next) {
			value = next;
		},
	} satisfies ControllableSource<unknown[]>;
}

describe("Controllable with an array written through a proxying binding", () => {
	const arrayOptions = { default: () => [] as unknown[], name: "Test", state: "value" };

	it("reads the written array, its object items as written", () => {
		const source = arraySource(undefined);
		const value = new Controllable<unknown[]>(source, arrayOptions);
		const written = [A, "b"];
		expect(value.set(written, details())).toBe(true);
		expect(source.value).not.toBe(written);
		expect(value.current).toBe(written);
		expect(value.current[0]).toBe(A);
	});

	it("sees the proxy mutated in place, keeping written object items as written", () => {
		const source = arraySource(undefined);
		const value = new Controllable<unknown[]>(source, arrayOptions);
		let current: unknown[] = [];
		const cleanup = $effect.root(() => {
			$effect(() => {
				current = value.current;
			});
		});
		try {
			value.set([A], details());
			flushSync();
			source.value!.push("b");
			flushSync();
			expect(current).toEqual([A, "b"]);
			expect(current[0]).toBe(A);

			// A write built from what it read keeps the pushed item.
			expect(value.set([...current, B], details())).toBe(true);
			flushSync();
			expect(current).toEqual([A, "b", B]);
		} finally {
			cleanup();
		}
	});

	it("writes its default to an unset binding as a mutable array", () => {
		const source = arraySource(undefined);
		const value = new Controllable<unknown[]>(source, arrayOptions);
		expect(() => source.value!.push("b")).not.toThrow();
		expect(value.current).toEqual(["b"]);
	});
});
