// `String.prototype.normalize`, over unorm's normalization: on strings without it, as PrimJS builds
// them without its Unicode tables (as Lynx does), against this process's own (V8's, over ICU).

import { describe, expect, it } from "@rstest/core";
import fc from "fast-check";

import { fillNormalize } from "../../src/fills/language/normalize.ts";
import { fillOnDevice, isConstructor, outcome } from "./device-built-ins.ts";

// Boundary: a method of strings, called on any receiver.
type Normalize = (this: unknown, ...args: unknown[]) => string;
const own = String.prototype.normalize as Normalize;
const [normalize] = fillOnDevice({
	gaps: [[String.prototype, "normalize"]],
	fill: fillNormalize,
}) as [Normalize];

/**
 * Characters each form changes, in Unicode 8.0 (unorm's data): letters and their combining marks out
 * of order, Hangul, compatibility characters, singletons, composition exclusions and astral ones.
 */
const UNITS = [
	"a",
	"e",
	"A",
	"́",
	"̣",
	"̛",
	"̈",
	"̀",
	"é",
	"ệ",
	"Å",
	"Ω",
	"ᄀ",
	"ᅡ",
	"ᆨ",
	"가",
	"한",
	"ﬁ",
	"①",
	"㎏",
	"½",
	"क़",
	"क",
	"़",
	"ά",
	"ά",
	"ΐ",
	"\u{1D15E}",
	"\u{2F800}",
	"ཱི",
	"Å",
	"ͅ",
];
const FORMS = ["NFC", "NFD", "NFKC", "NFKD"] as const;

describe("on strings without it", () => {
	it("puts one in its place, not enumerable, as the built-in is", () => {
		expect(normalize).toBeTypeOf("function");
		expect(normalize).not.toBe(own);
		expect(normalize.name).toBe("normalize");
		expect(normalize.length).toBe(0);
		expect(isConstructor(normalize)).toBe(false);
	});
});

describe("the normalize it gives", () => {
	it("gives each form as V8's does, for text of Unicode 8.0", () => {
		fc.assert(
			fc.property(fc.array(fc.constantFrom(...UNITS), { maxLength: 8 }), (units) => {
				const text = units.join("");
				for (const form of FORMS)
					expect(normalize.call(text, form), form).toBe(own.call(text, form));
				expect(normalize.call(text)).toBe(own.call(text));
			}),
			{ numRuns: 2000 },
		);
	});

	it("reads its receiver and form as V8's does, and refuses what V8's refuses", () => {
		const cases: [receiver: unknown, args: unknown[]][] = [
			["é", [undefined]],
			["é", [{ toString: () => "NFD" }]],
			["é", ["nfd"]],
			["é", [null]],
			["é", [Symbol("NFC")]],
			[
				"é",
				[
					{
						toString() {
							throw new RangeError("from form");
						},
					},
				],
			],
			[null, ["NFC"]],
			[undefined, []],
			[Symbol("text"), []],
			[42, ["NFKD"]],
			[{ toString: () => "Å" }, ["NFC"]],
		];
		for (const [receiver, args] of cases)
			expect(outcome(() => normalize.apply(receiver, args))).toEqual(
				outcome(() => own.apply(receiver, args)),
			);
	});

	it("reads its receiver before its form", () => {
		const order: string[] = [];
		const receiver = { toString: () => (order.push("receiver"), "a") };
		const form = { toString: () => (order.push("form"), "NFC") };
		normalize.call(receiver, form);
		expect(order).toEqual(["receiver", "form"]);
	});
});
