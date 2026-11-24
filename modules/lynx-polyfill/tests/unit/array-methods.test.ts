// ES2022's and ES2023's methods of arrays and typed arrays, by core-js's modules: on built-ins that
// lack them, as PrimJS's do, against this process's own (V8's, which pass test262).

import { describe, expect, it } from "@rstest/core";
import fc from "fast-check";

import { fillArrayMethods } from "../../src/fills/language/array-methods.ts";
import { fillOnDevice, outcome } from "./device-built-ins.ts";

const ARRAYS = Array.prototype;
const TYPED_ARRAYS: object = Object.getPrototypeOf(Int8Array.prototype);
const ARRAY_METHODS = [
	"at",
	"findLast",
	"findLastIndex",
	"toReversed",
	"toSorted",
	"toSpliced",
	"with",
];
const TYPED_ARRAY_METHODS = ["at", "toReversed", "toSorted", "with"];

// Boundary: a method of either prototype, called on any receiver.
type Method = (this: unknown, ...args: unknown[]) => unknown;

const own = new Map<string, Method>();
const filled = new Map<string, Method>();
const gaps = [
	...ARRAY_METHODS.map((name) => [ARRAYS, name] as const),
	...TYPED_ARRAY_METHODS.map((name) => [TYPED_ARRAYS, name] as const),
];
gaps.forEach(([owner, name]) => {
	own.set(
		`${owner === ARRAYS ? "Array" : "TypedArray"}#${name}`,
		(owner as Record<string, Method>)[name]!,
	);
});
fillOnDevice({ gaps, fill: fillArrayMethods }).forEach((method, index) => {
	const [owner, name] = gaps[index]!;
	filled.set(`${owner === ARRAYS ? "Array" : "TypedArray"}#${name}`, method as Method);
});

describe("on an engine that lacks them", () => {
	it("puts core-js's on both prototypes, not enumerable, as built-ins are", () => {
		for (const [key, method] of filled) {
			expect(method, key).toBeTypeOf("function");
			expect(method, key).not.toBe(own.get(key));
		}
		expect(own.get("Array#at")).toBe(ARRAYS.at);
	});
});

describe("the methods it gives", () => {
	const values = fc.array(fc.integer({ min: -5, max: 5 }), { maxLength: 8 });
	const index = fc.oneof(
		fc.integer({ min: -10, max: 10 }),
		fc.constantFrom(NaN, Infinity, -0, 1.5),
	);

	/** Calls the filled method and this process's own the same way, and compares. */
	function same(key: string, receiver: () => unknown, ...args: unknown[]): void {
		const copy = () => {
			const value = receiver();
			return ArrayBuffer.isView(value) ? Array.from(value as Int8Array) : value;
		};
		const normalize = (value: unknown) =>
			ArrayBuffer.isView(value) ? { typed: Array.from(value as Int8Array) } : value;
		const filledOutcome = outcome(() => normalize(filled.get(key)!.apply(receiver(), args)));
		const ownOutcome = outcome(() => normalize(own.get(key)!.apply(receiver(), args)));
		expect(
			filledOutcome,
			`${key}(${args.map(String).join(", ")}) on ${JSON.stringify(copy())}`,
		).toEqual(ownOutcome);
	}

	it("index and search arrays as V8's do", () => {
		fc.assert(
			fc.property(values, index, (array, at) => {
				same("Array#at", () => array, at);
				same(
					"Array#findLast",
					() => array,
					(value: number) => value > 0,
				);
				same(
					"Array#findLastIndex",
					() => array,
					(value: number) => value < 0,
				);
			}),
		);
	});

	it("copy arrays as V8's do, and leave the original", () => {
		fc.assert(
			fc.property(values, index, index, (array, start, count) => {
				const before = [...array];
				same("Array#toReversed", () => array);
				same("Array#toSorted", () => array);
				same(
					"Array#toSorted",
					() => array,
					(a: number, b: number) => b - a,
				);
				same("Array#toSpliced", () => array, start, count, 9);
				same("Array#with", () => array, start, 9);
				expect(array).toEqual(before);
			}),
		);
	});

	it("index and copy typed arrays as V8's do", () => {
		fc.assert(
			fc.property(values, index, (array, at) => {
				const typed = () => Int8Array.from(array);
				same("TypedArray#at", typed, at);
				same("TypedArray#toReversed", typed);
				same("TypedArray#toSorted", typed);
				same("TypedArray#with", typed, at, 9);
			}),
		);
	});

	it("work on array-likes and holes, and refuse a missing receiver and a bad comparator", () => {
		const arrayLike = () => ({ length: 3, 0: "a", 2: "c" });
		same("Array#at", arrayLike, -1);
		same("Array#toReversed", arrayLike);
		same("Array#toSpliced", arrayLike, 1, 0, "b");
		same("Array#with", arrayLike, 1, "b");
		same("Array#at", () => undefined, 0);
		same("Array#toSorted", () => [2, 1], "not a function");
		same("TypedArray#with", () => new Int8Array(2), 5, 1);
		same("TypedArray#at", () => [1], 0);
	});
});
