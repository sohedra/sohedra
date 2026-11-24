// ES2022's `Object.hasOwn` and ES2024's `Object.groupBy` and `Map.groupBy`, by core-js's modules:
// on built-ins that lack them, as PrimJS's do, against this process's own.

import { describe, expect, it } from "@rstest/core";
import fc from "fast-check";

import { fillObjectMethods } from "../../../src/polyfill/language/object-methods.ts";
import { fillOnDevice, outcome } from "./device-built-ins.ts";

// Boundary: the statics as this process has them, ES2024's included.
const objects = Object as unknown as Record<string, (...args: unknown[]) => unknown>;
const maps = Map as unknown as Record<string, (...args: unknown[]) => unknown>;
const own = {
	hasOwn: objects["hasOwn"]!,
	groupBy: objects["groupBy"]!,
	mapGroupBy: maps["groupBy"]!,
};
const [hasOwn, groupBy, mapGroupBy] = fillOnDevice({
	gaps: [
		[Object, "hasOwn"],
		[Object, "groupBy"],
		[Map, "groupBy"],
	],
	fill: fillObjectMethods,
}) as ((...args: unknown[]) => unknown)[];

describe("on an engine that lacks them", () => {
	it("puts core-js's in their place", () => {
		expect([hasOwn, groupBy, mapGroupBy].map((method) => typeof method)).toEqual([
			"function",
			"function",
			"function",
		]);
		expect(hasOwn).not.toBe(own.hasOwn);
		expect(groupBy).not.toBe(own.groupBy);
		expect(mapGroupBy).not.toBe(own.mapGroupBy);
	});
});

describe("the methods it gives", () => {
	it("tell own properties from inherited ones, as V8's does", () => {
		const child = Object.create({ inherited: 1 }, { hidden: { value: 2 } }) as object;
		for (const [value, key] of [
			[child, "inherited"],
			[child, "hidden"],
			[{ [Symbol.iterator]: 1 }, Symbol.iterator],
			["text", "length"],
			[null, "a"],
		] as const)
			expect(outcome(() => hasOwn!(value, key))).toEqual(outcome(() => own.hasOwn(value, key)));
	});

	it("group into a null-prototype object and into a Map, as V8's do", () => {
		fc.assert(
			fc.property(fc.array(fc.integer({ min: -3, max: 3 })), (values) => {
				const key = (value: number) => (value > 0 ? "up" : value < 0 ? "down" : "flat");
				const grouped = groupBy!(values, key) as object;
				expect(Object.getPrototypeOf(grouped)).toBe(null);
				expect({ ...grouped }).toEqual({ ...(own.groupBy(values, key) as object) });
				expect(mapGroupBy!(values, key)).toEqual(own.mapGroupBy(values, key));
			}),
		);
		expect(outcome(() => groupBy!([1], "not a function"))).toEqual(
			outcome(() => own.groupBy([1], "not a function")),
		);
		expect(outcome(() => mapGroupBy!(null, String))).toEqual(
			outcome(() => own.mapGroupBy(null, String)),
		);
	});
});
