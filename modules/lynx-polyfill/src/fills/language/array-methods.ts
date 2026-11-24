// ES2022's and ES2023's methods of arrays and typed arrays, by core-js's modules: ECMA-262 § 23.1.3
// (`at`, `findLast`, `findLastIndex`, `toReversed`, `toSorted`, `toSpliced`, `with`) and § 23.2.3
// (`at`, `toReversed`, `toSorted`, `with`; PrimJS's typed arrays have `findLast` and
// `findLastIndex`). Leaves out nothing.

import { fillFromCoreJs } from "./core-js.ts";

/**
 * PrimJS lacks them on both threads.
 *
 * @workaround language-array-methods kind=lynx-gap delete-when="the engine of the oldest Lynx the package supports has ES2023's methods of arrays and typed arrays"
 */
export function fillArrayMethods(): void {
	const arrays = Array.prototype;
	// `%TypedArray%.prototype`, which every typed array inherits from.
	const typedArrays: object = Object.getPrototypeOf(Int8Array.prototype);
	fillFromCoreJs([
		["es.array.at", arrays, "at"],
		["es.array.find-last", arrays, "findLast"],
		["es.array.find-last-index", arrays, "findLastIndex"],
		["es.array.to-reversed", arrays, "toReversed"],
		["es.array.to-sorted", arrays, "toSorted"],
		["es.array.to-spliced", arrays, "toSpliced"],
		["es.array.with", arrays, "with"],
		["es.typed-array.at", typedArrays, "at"],
		["es.typed-array.to-reversed", typedArrays, "toReversed"],
		["es.typed-array.to-sorted", typedArrays, "toSorted"],
		["es.typed-array.with", typedArrays, "with"],
	]);
}
