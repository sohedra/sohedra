// `BigInt.asUintN`, where the engine's leaves a negative value as it is for 64 bits or more, as
// PrimJS's does: against this process's own, which passes test262.

import { describe, expect, it } from "@rstest/core";
import fc from "fast-check";

import { createAsUintN, fillBigIntAsUintN } from "../../src/fills/language/bigint-as-uint-n.ts";
import { fillOnDevice, isConstructor, outcome } from "./device-built-ins.ts";

const own = BigInt.asUintN;

/** PrimJS's: right modulo 2 ** bits, but a negative value stays negative from 64 bits on. */
function asUintNAsPrimJs(bits: number, bigint: bigint): bigint {
	const result = own(bits, bigint);
	return bits >= 64 && bigint < 0n && -bigint < 2n ** BigInt(bits) ? bigint : result;
}

describe("the fill", () => {
	it("replaces PrimJS's", () => {
		const [filled] = fillOnDevice({
			gaps: [[BigInt, "asUintN", asUintNAsPrimJs]],
			fill: fillBigIntAsUintN,
		});
		expect(filled).toBeTypeOf("function");
		expect(filled).not.toBe(asUintNAsPrimJs);
		expect((filled as typeof own)(64, -1n)).toBe(2n ** 64n - 1n);
		expect((filled as typeof own).name).toBe("asUintN");
		expect((filled as typeof own).length).toBe(2);
		expect(isConstructor(filled)).toBe(false);
	});

	it("leaves one that gets it right, and adds none to an engine without BigInt or asUintN", () => {
		fillOnDevice({ gaps: [], fill: fillBigIntAsUintN });
		expect(BigInt.asUintN).toBe(own);
		expect(fillOnDevice({ gaps: [[globalThis, "BigInt"]], fill: fillBigIntAsUintN })).toEqual([
			undefined,
		]);
		expect(fillOnDevice({ gaps: [[BigInt, "asUintN"]], fill: fillBigIntAsUintN })).toEqual([
			undefined,
		]);
	});
});

describe("the asUintN it gives", () => {
	const asUintN = createAsUintN(asUintNAsPrimJs);

	it("gives what V8's gives for every number of bits and value", () => {
		fc.assert(
			fc.property(
				fc.integer({ min: 0, max: 200 }),
				fc.bigInt({ min: -(2n ** 210n), max: 2n ** 210n }),
				(bits, value) => {
					expect(asUintN(bits, value)).toBe(own(bits, value));
				},
			),
			{ numRuns: 2000 },
		);
	});

	it("converts its arguments as V8's does, and refuses what V8's refuses", () => {
		for (const [bits, value] of [
			[64, -1n],
			[0, -5n],
			[-0, 3n],
			[1.9, 3n],
			["64", -1n],
			[undefined, 1n],
			[NaN, 1n],
			[-1, 1n],
			[2 ** 53, 1n],
			[Infinity, 1n],
			[1n, 1n],
			[Symbol(), 1n],
			[8, 1],
			[8, "257"],
			[8, true],
			[8, "x"],
			[8, { valueOf: () => 257n }],
		] as const)
			expect(outcome(() => asUintN(bits as number, value as bigint))).toEqual(
				outcome(() => own(bits as number, value as bigint)),
			);
	});
});
