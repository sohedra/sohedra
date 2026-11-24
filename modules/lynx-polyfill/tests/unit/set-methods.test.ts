// ES2025's methods of sets, by core-js's modules: on a `Set.prototype` that lacks them, as PrimJS's
// does, against this process's own.

import { describe, expect, it } from "@rstest/core";
import fc from "fast-check";

import { fillSetMethods } from "../../src/fills/language/set-methods.ts";
import { fillOnDevice, outcome } from "./device-built-ins.ts";

const NAMES = [
	"difference",
	"intersection",
	"isDisjointFrom",
	"isSubsetOf",
	"isSupersetOf",
	"symmetricDifference",
	"union",
] as const;
// Boundary: a method of sets, called on any receiver.
type Method = (this: unknown, other: unknown) => unknown;
const sets = Set.prototype as unknown as Record<string, Method>;
const own = Object.fromEntries(NAMES.map((name) => [name, sets[name]!]));
const filled = Object.fromEntries(
	fillOnDevice({
		gaps: NAMES.map((name) => [Set.prototype, name] as const),
		fill: fillSetMethods,
	}).map((method, index) => [NAMES[index]!, method as Method]),
);

/** A set, or what a method gives, as a plain value to compare: the order of a set's values counts. */
function plain(value: unknown): unknown {
	return value instanceof Set ? { set: [...value] } : value;
}

/** The filled method and V8's, called the same way, give the same. */
function same(name: (typeof NAMES)[number], receiver: () => unknown, other: () => unknown): void {
	expect(
		outcome(() => plain(filled[name]!.call(receiver(), other()))),
		name,
	).toEqual(outcome(() => plain(own[name]!.call(receiver(), other()))));
}

describe("on an engine that lacks them", () => {
	it("puts core-js's in their place", () => {
		for (const name of NAMES) {
			expect(filled[name], name).toBeTypeOf("function");
			expect(filled[name], name).not.toBe(own[name]);
		}
	});
});

describe("the methods it gives", () => {
	const values = fc.array(fc.integer({ min: 0, max: 6 }), { maxLength: 6 });

	it("combine and compare sets as V8's do, in V8's order", () => {
		fc.assert(
			fc.property(values, values, (left, right) => {
				for (const name of NAMES)
					same(
						name,
						() => new Set(left),
						() => new Set(right),
					);
			}),
		);
	});

	it("take a Map and a set-like object, and refuse what V8's refuses", () => {
		const setLike = () => ({
			size: 2,
			has: (value: number) => value < 2,
			keys: () => [0, 1][Symbol.iterator](),
		});
		for (const name of NAMES) {
			same(
				name,
				() => new Set([0, 3]),
				() =>
					new Map([
						[0, "a"],
						[5, "b"],
					]),
			);
			same(name, () => new Set([0, 3]), setLike);
			same(
				name,
				() => new Set([1]),
				() => [1],
			);
			same(
				name,
				() => new Set([1]),
				() => ({ size: NaN, has: () => true, keys: () => [][Symbol.iterator]() }),
			);
			same(
				name,
				() => ({}),
				() => new Set(),
			);
		}
	});
});
