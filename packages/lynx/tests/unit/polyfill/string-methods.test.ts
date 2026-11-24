// ES2021's to ES2024's methods of strings, by core-js's modules: on built-ins that lack them, as
// PrimJS's do, against this process's own.

import { describe, expect, it } from "@rstest/core";
import fc from "fast-check";

import { fillStringMethods } from "../../../src/polyfill/language/string-methods.ts";
import { fillOnDevice, outcome } from "./device-built-ins.ts";

const NAMES = ["at", "isWellFormed", "replaceAll", "toWellFormed"] as const;
// Boundary: a method of strings, called on any receiver.
type Method = (this: unknown, ...args: unknown[]) => unknown;
const strings = String.prototype as unknown as Record<string, Method>;
const own = Object.fromEntries(NAMES.map((name) => [name, strings[name]!]));
const filled = Object.fromEntries(
	fillOnDevice({
		gaps: NAMES.map((name) => [String.prototype, name] as const),
		fill: fillStringMethods,
	}).map((method, index) => [NAMES[index]!, method as Method]),
);

/** The filled method and V8's, called the same way, give the same. */
function same(name: (typeof NAMES)[number], receiver: unknown, ...args: unknown[]): void {
	expect(
		outcome(() => filled[name]!.apply(receiver, args)),
		`${name} on ${String(receiver)}`,
	).toEqual(outcome(() => own[name]!.apply(receiver, args)));
}

describe("on an engine that lacks them", () => {
	it("puts core-js's in their place, not enumerable", () => {
		for (const name of NAMES) {
			expect(filled[name], name).toBeTypeOf("function");
			expect(filled[name], name).not.toBe(own[name]);
		}
	});
});

describe("the methods it gives", () => {
	const text = fc.string({
		unit: fc.constantFrom("a", ".", "$", "\uD83D", "\uDE00", "\uD842", "b"),
	});

	it("index by code unit and find lone surrogates, as V8's do", () => {
		fc.assert(
			fc.property(text, fc.integer({ min: -6, max: 6 }), (value, index) => {
				same("at", value, index);
				same("isWellFormed", value);
				same("toWellFormed", value);
			}),
		);
		same("at", null, 0);
		same("toWellFormed", { toString: () => "a\uD800" });
	});

	it.each([
		["a.b.a", "a", "x"],
		["aaaa", "aa", "b"],
		["abc", "", "-"],
		["", "", "-"],
		["a.b.a", ".", "$$"],
		["a.b.a", "b", "[$&]"],
		["a.b.a", "b", "[$`]"],
		["a.b.a", "b", "[$']"],
		["a.b.a", "b", "$1$<n>$"],
		["a/*x*/b/*y*/", /\/\*.*?\*\//g, ""],
		["aXbX", /x/gi, "$&$&"],
		["C:\\a\\b", "\\", "/"],
		["<p><!----></p>", "<!---->", ""],
		["a-b-a", /(?<letter>a)/g, "<$<letter>>"],
	])("replaces in %j every %s with %j as V8's does", (value, search, replacement) => {
		same("replaceAll", value, search, replacement);
	});

	it("replaces every match as V8's does, calls a function for each, and refuses what V8's refuses", () => {
		fc.assert(
			fc.property(text, text, text, (value, search, replacement) => {
				same("replaceAll", value, search, replacement);
			}),
		);
		const seen: unknown[][] = [];
		expect(
			filled["replaceAll"]!.call("a-b-a", "a", (...args: unknown[]) => {
				seen.push(args);
				return "A";
			}),
		).toBe("A-b-A");
		expect(seen).toEqual([
			["a", 0, "a-b-a"],
			["a", 4, "a-b-a"],
		]);
		same("replaceAll", "a", /a/, "b");
		same("replaceAll", undefined, "a", "b");
	});
});
