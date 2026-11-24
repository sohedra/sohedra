// ES2025's iterator helpers, by core-js's modules: on an engine without the `Iterator` global and
// the methods of `%IteratorPrototype%`, as PrimJS, against this process's own.

import { describe, expect, it } from "@rstest/core";
import fc from "fast-check";

import { fillIteratorHelpers } from "../../src/fills/language/iterator-helpers.ts";
import { fillOnDevice, outcome } from "./device-built-ins.ts";

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
// Boundary: ES2025's `Iterator`, which this package's types leave out.
type Method = (this: unknown, ...args: unknown[]) => unknown;
interface IteratorClass {
	from(value: unknown): unknown;
	prototype: Record<string, Method>;
}
const prototype = Object.getPrototypeOf(Object.getPrototypeOf([][Symbol.iterator]())) as Record<
	string,
	Method
>;
const OwnIterator = (globalThis as unknown as { Iterator: IteratorClass }).Iterator;
const own = Object.fromEntries(METHODS.map((name) => [name, prototype[name]!]));
const [FilledIterator, ...methods] = fillOnDevice({
	gaps: [[globalThis, "Iterator"], ...METHODS.map((name) => [prototype, name] as const)],
	fill: fillIteratorHelpers,
}) as [IteratorClass, ...Method[]];
const filled = Object.fromEntries(METHODS.map((name, index) => [name, methods[index]!]));

/** What a method gives, as a plain value: an iterator read to its end. */
function plain(value: unknown): unknown {
	return typeof value === "object" && value !== null && Symbol.iterator in value
		? { values: [...(value as Iterable<unknown>)] }
		: value;
}

/** The filled method and V8's, called on a fresh iterator of `values`, give the same. */
function same(
	name: (typeof METHODS)[number],
	values: () => Iterator<unknown>,
	...args: unknown[]
): void {
	expect(
		outcome(() => plain(filled[name]!.apply(values(), args))),
		name,
	).toEqual(outcome(() => plain(own[name]!.apply(values(), args))));
}

describe("on an engine that lacks them", () => {
	it("puts core-js's Iterator, over the engine's own prototype of iterators, and its methods", () => {
		expect(FilledIterator).toBeTypeOf("function");
		expect(FilledIterator).not.toBe(OwnIterator);
		expect(FilledIterator.prototype).toBe(prototype);
		for (const name of METHODS) {
			expect(filled[name], name).toBeTypeOf("function");
			expect(filled[name], name).not.toBe(own[name]);
		}
	});
});

describe("the helpers it gives", () => {
	const numbers = fc.array(fc.integer({ min: -4, max: 4 }), { maxLength: 8 });
	const count = fc.oneof(fc.integer({ min: 0, max: 10 }), fc.constantFrom(-1, NaN, Infinity, 1.5));

	it("map, filter, take and drop lazily, and reduce, as V8's do", () => {
		fc.assert(
			fc.property(numbers, count, (values, limit) => {
				const iterate = () => values[Symbol.iterator]();
				same("map", iterate, (value: number, index: number) => value * index);
				same("filter", iterate, (value: number) => value > 0);
				same("take", iterate, limit);
				same("drop", iterate, limit);
				same("flatMap", iterate, (value: number) => [value, value]);
				same("reduce", iterate, (sum: number, value: number) => sum + value);
				same("reduce", iterate, (sum: number, value: number) => sum + value, 10);
				same("toArray", iterate);
				same("some", iterate, (value: number) => value === 0);
				same("every", iterate, (value: number) => value !== 0);
				same("find", iterate, (value: number) => value < 0);
			}),
		);
	});

	it("call forEach for each value, close what they stop early, and refuse what V8's refuses", () => {
		const seen: unknown[] = [];
		filled["forEach"]!.call([1, 2][Symbol.iterator](), (value: unknown) => seen.push(value));
		expect(seen).toEqual([1, 2]);
		const closed: string[] = [];
		const closing = () => ({
			next: () => ({ value: 1, done: false }),
			return: () => {
				closed.push("closed");
				return { done: true, value: undefined };
			},
			__proto__: prototype,
		});
		filled["some"]!.call(closing(), () => true);
		filled["find"]!.call(closing(), () => true);
		expect(closed).toEqual(["closed", "closed"]);
		same("map", () => [1][Symbol.iterator](), "not a function");
		same("take", () => [1][Symbol.iterator](), -1);
		same(
			"flatMap",
			() => [1][Symbol.iterator](),
			() => 1,
		);
		same(
			"reduce",
			() => [][Symbol.iterator](),
			(a: number) => a,
		);
	});

	it("make iterators with Iterator.from, as V8's does", () => {
		const iterable = { [Symbol.iterator]: () => [1, 2][Symbol.iterator]() };
		const plainNext = { next: () => ({ done: true, value: undefined }) };
		for (const value of [iterable, plainNext, "ab", [3]])
			expect(outcome(() => plain(FilledIterator.from(value)))).toEqual(
				outcome(() => plain(OwnIterator.from(value))),
			);
		expect(outcome(() => FilledIterator.from(1))).toEqual(outcome(() => OwnIterator.from(1)));
	});
});
