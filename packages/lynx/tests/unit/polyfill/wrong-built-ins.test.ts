// The built-ins PrimJS has and gets wrong: each replaced by core-js's own where it gets that wrong,
// and left where it gets it right.

import { afterEach, beforeAll, describe, expect, it, rs } from "@rstest/core";

import { fillWrongBuiltIns } from "../../../src/polyfill/language/wrong-built-ins.ts";
import { forceCoreJs, loadCoreJs } from "../../../src/polyfill/vendor/core-js.js";
import { fillOnDevice, thrown } from "./device-built-ins.ts";

rs.mock("../../../src/polyfill/vendor/core-js.js", { spy: true });
afterEach(() => {
	rs.clearAllMocks();
});

const own = {
	assign: Object.assign,
	getOwnPropertyDescriptor: Object.getOwnPropertyDescriptor,
	apply: Reflect.apply,
	matchAll: String.prototype.matchAll,
};

/** PrimJS's `Object.assign`: it reads which keys are enumerable before it copies any. */
function assignAsPrimJs(target: object, ...sources: object[]): object {
	for (const source of sources) {
		const keys = [
			...Object.keys(source),
			...Object.getOwnPropertySymbols(source).filter((key) =>
				Object.prototype.propertyIsEnumerable.call(source, key),
			),
		];
		for (const key of keys)
			(target as Record<PropertyKey, unknown>)[key] = (source as Record<PropertyKey, unknown>)[key];
	}
	return target;
}

/** PrimJS's `Object.getOwnPropertyDescriptor`: nothing for a primitive. */
function descriptorAsPrimJs(value: unknown, key: PropertyKey): PropertyDescriptor | undefined {
	return (typeof value === "object" && value !== null) || typeof value === "function"
		? own.getOwnPropertyDescriptor(value, key)
		: undefined;
}

/** PrimJS's `Reflect.apply`: no list of arguments is an empty one. */
function applyAsPrimJs(
	target: (...args: unknown[]) => unknown,
	self: unknown,
	args?: ArrayLike<unknown>,
): unknown {
	return own.apply(target, self, args ?? []);
}

/** PrimJS's `String.prototype.matchAll`: a regular expression that is not global is made global. */
function matchAllAsPrimJs(this: string, pattern: unknown): unknown {
	const global =
		pattern instanceof RegExp && !pattern.global
			? new RegExp(pattern.source, `${pattern.flags}g`)
			: pattern;
	return own.matchAll.call(this, global as RegExp);
}

describe("on an engine that gets them right", () => {
	it("loads none of core-js's", () => {
		fillOnDevice({ gaps: [], fill: fillWrongBuiltIns });
		expect(loadCoreJs).not.toHaveBeenCalled();
		expect(forceCoreJs).not.toHaveBeenCalled();
	});
});

describe("on an engine that gets them wrong, as PrimJS does", () => {
	let filled: unknown[];
	let assign: typeof Object.assign;
	let getOwnPropertyDescriptor: typeof Object.getOwnPropertyDescriptor;
	let apply: typeof Reflect.apply;
	let matchAll: (this: string, pattern: unknown) => IterableIterator<RegExpMatchArray>;
	beforeAll(() => {
		filled = fillOnDevice({
			gaps: [
				[Object, "assign", assignAsPrimJs],
				[Object, "getOwnPropertyDescriptor", descriptorAsPrimJs],
				[Reflect, "apply", applyAsPrimJs],
				[String.prototype, "matchAll", matchAllAsPrimJs],
			],
			fill: fillWrongBuiltIns,
		});
		[assign, getOwnPropertyDescriptor, apply, matchAll] = filled as [
			typeof assign,
			typeof getOwnPropertyDescriptor,
			typeof apply,
			typeof matchAll,
		];
	});

	it("replaces each with core-js's, forced past core-js's own check", () => {
		expect(rs.mocked(forceCoreJs).mock.calls).toEqual([
			["Object.assign"],
			["Object.getOwnPropertyDescriptor"],
			["Reflect.apply"],
			["String#matchAll"],
		]);
		expect(filled).not.toContain(assignAsPrimJs);
		expect(filled).not.toContain(descriptorAsPrimJs);
		expect(filled).not.toContain(applyAsPrimJs);
		expect(filled).not.toContain(matchAllAsPrimJs);
		expect(filled.map((method) => typeof method)).toEqual([
			"function",
			"function",
			"function",
			"function",
		]);
		expect(Object.assign).toBe(own.assign);
	});

	it("gives an Object.assign that skips a key a getter hides as it copies", () => {
		const source: Record<string, unknown> = {};
		Object.defineProperty(source, "a", {
			enumerable: true,
			get: () => Object.defineProperty(source, "b", { value: 3, enumerable: false }),
		});
		source["b"] = 2;
		expect(assign({ b: 1 }, source)["b"]).toBe(1);
		const symbol = Symbol("s");
		expect(assign({}, { a: 1 }, null, { [symbol]: 2 }, "xy")).toEqual({
			a: 1,
			[symbol]: 2,
			0: "x",
			1: "y",
		});
	});

	it("gives an Object.getOwnPropertyDescriptor that reads a primitive as its object", () => {
		expect(getOwnPropertyDescriptor("qwe", "0")).toEqual(
			own.getOwnPropertyDescriptor(Object("qwe"), "0"),
		);
		expect(getOwnPropertyDescriptor({ a: 1 }, "a")).toEqual(
			own.getOwnPropertyDescriptor({ a: 1 }, "a"),
		);
		expect(thrown(() => getOwnPropertyDescriptor(undefined, "a"))).toBeInstanceOf(TypeError);
	});

	it("gives a Reflect.apply that refuses a missing list of arguments", () => {
		expect(thrown(() => (apply as (target: unknown) => unknown)(() => 1))).toBeInstanceOf(
			TypeError,
		);
		expect(apply(Math.max, undefined, [1, 3])).toBe(3);
	});

	it("gives a matchAll that refuses a regular expression that is not global", () => {
		expect(thrown(() => matchAll.call("a", /./))).toBeInstanceOf(TypeError);
		expect([...matchAll.call("abab", /a/g)].map((match) => match.index)).toEqual([0, 2]);
		// A string is a pattern, made global: "." matches every character, as V8's does.
		expect([...matchAll.call("a.a", ".")].map((match) => match.index)).toEqual(
			// Boundary: V8's takes a string too, which its type leaves out.
			[...own.matchAll.call("a.a", "." as unknown as RegExp)].map((match) => match.index),
		);
	});
});
