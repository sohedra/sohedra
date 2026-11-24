// `BigInt.asUintN`: ECMA-262 § 21.2.2.2. PrimJS's leaves a negative value as it is for 64 bits or
// more (`asUintN(64, -1n)` is `-1n`), though always equal to the right one modulo 2 ** bits. This
// adds 2 ** bits to such a value; the engine's own converts the arguments and does the rest.

import { globalScope } from "../globals.ts";
import { holds, installEager } from "../install.ts";

/** `BigInt.asUintN`'s signature. */
type AsUintN = (bits: number, bigint: bigint) => bigint;

/**
 * Wrong on both threads.
 *
 * @workaround language-bigint-as-uint-n kind=lynx-bug delete-when="the engine of the oldest Lynx the package supports gives BigInt.asUintN(64, -1n) as 2n ** 64n - 1n"
 */
export function fillBigIntAsUintN(): void {
	// Boundary: the standard global, which an engine may lack.
	const bigInts = globalScope["BigInt"] as { asUintN?: AsUintN } | undefined;
	const own = bigInts?.asUintN;
	if (bigInts === undefined || typeof own !== "function") return;
	installEager(bigInts, "asUintN", createAsUintN(own), (existing) =>
		holds(() => (existing as AsUintN)(64, BigInt(-1)) === BigInt("18446744073709551615")),
	);
}

/**
 * `BigInt.asUintN` over the engine's own `asUintN`, which is right but for the sign. A method, as a
 * built-in's is: it can't be called with `new`.
 */
export function createAsUintN(own: AsUintN): AsUintN {
	return {
		asUintN(bits: number, bigint: bigint): bigint {
			const index = toIndex(bits);
			const result = own(index, bigint);
			return result < 0 ? result + BigInt(2) ** BigInt(index) : result;
		},
	}.asUintN;
}

/** ECMA-262's `ToIndex`: a whole number of bits from 0 to 2 ** 53 - 1. */
function toIndex(value: unknown): number {
	// Unary plus, as `ToNumber`: it throws for a BigInt or a Symbol.
	const number = +(value as number);
	const integer = Number.isNaN(number) ? 0 : Math.trunc(number);
	if (integer < 0 || integer > Number.MAX_SAFE_INTEGER)
		throw new RangeError(
			`BigInt.asUintN takes a number of bits from 0 to 2 ** 53 - 1, and was given ${String(value)}.`,
		);
	return integer;
}
