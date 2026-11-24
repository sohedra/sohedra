// ES2025's half-precision numbers, by core-js's modules: on an engine without `Math.f16round` and
// `DataView`'s `getFloat16` and `setFloat16`, as PrimJS, against this process's own.

import { describe, expect, it } from "@rstest/core";
import fc from "fast-check";

import { fillFloat16 } from "../../../src/polyfill/language/float16.ts";
import { fillOnDevice, outcome } from "./device-built-ins.ts";

// Boundary: ES2025's methods, which this package's types leave out.
type Round = (value: unknown) => number;
type Get = (this: DataView, offset: unknown, littleEndian?: unknown) => number;
type Set = (this: DataView, offset: unknown, value: unknown, littleEndian?: unknown) => void;
const views = DataView.prototype as unknown as { getFloat16: Get; setFloat16: Set };
const own = {
	f16round: (Math as unknown as { f16round: Round }).f16round,
	getFloat16: views.getFloat16,
	setFloat16: views.setFloat16,
};
const [f16round, getFloat16, setFloat16] = fillOnDevice({
	gaps: [
		[Math, "f16round"],
		[DataView.prototype, "getFloat16"],
		[DataView.prototype, "setFloat16"],
	],
	fill: fillFloat16,
}) as [Round, Get, Set];

describe("on an engine that lacks them", () => {
	it("puts core-js's in their place", () => {
		expect([f16round, getFloat16, setFloat16].map((method) => typeof method)).toEqual([
			"function",
			"function",
			"function",
		]);
		expect(f16round).not.toBe(own.f16round);
		expect(getFloat16).not.toBe(own.getFloat16);
		expect(setFloat16).not.toBe(own.setFloat16);
	});
});

describe("the methods it gives", () => {
	it("round every number to half precision as V8's does", () => {
		fc.assert(
			fc.property(fc.double(), (value) => {
				expect(Object.is(f16round(value), own.f16round(value))).toBe(true);
			}),
			{ numRuns: 5000 },
		);
		for (const value of [65504, 65520, 65519.99, 5.960464477539063e-8, 2.98e-8, -0, NaN, "1.5", 1n])
			expect(outcome(() => f16round(value))).toEqual(outcome(() => own.f16round(value)));
	});

	it("write and read half-precision bytes as V8's do, either way round", () => {
		fc.assert(
			fc.property(fc.double(), fc.boolean(), (value, little) => {
				const mine = new DataView(new ArrayBuffer(2));
				const theirs = new DataView(new ArrayBuffer(2));
				setFloat16.call(mine, 0, value, little);
				own.setFloat16.call(theirs, 0, value, little);
				expect(new Uint8Array(mine.buffer)).toEqual(new Uint8Array(theirs.buffer));
				expect(
					Object.is(getFloat16.call(mine, 0, little), own.getFloat16.call(theirs, 0, little)),
				).toBe(true);
			}),
			{ numRuns: 2000 },
		);
		const view = new DataView(new ArrayBuffer(2));
		expect(outcome(() => getFloat16.call(view, 1))).toEqual(
			outcome(() => own.getFloat16.call(view, 1)),
		);
		expect(outcome(() => setFloat16.call(view, -1, 1))).toEqual(
			outcome(() => own.setFloat16.call(view, -1, 1)),
		);
	});
});
