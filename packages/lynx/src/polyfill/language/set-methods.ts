// ES2025's methods of sets, by core-js's modules: ECMA-262 § 24.2.4 (`difference`, `intersection`,
// `isDisjointFrom`, `isSubsetOf`, `isSupersetOf`, `symmetricDifference`, `union`). Leaves out
// nothing. Not in a thread's list: a thread's script gets it when its code names them.

import { loadSetMethods } from "../vendor/set-methods.js";

/** The methods of `Set.prototype` this fills. */
const METHODS = [
	"difference",
	"intersection",
	"isDisjointFrom",
	"isSubsetOf",
	"isSupersetOf",
	"symmetricDifference",
	"union",
] as const;

/**
 * PrimJS lacks them on both threads.
 *
 * @workaround language-set-methods kind=lynx-gap delete-when="the engine of the oldest Lynx the binding supports has ES2025's methods of sets"
 */
export function fillSetMethods(): void {
	// Boundary: a built-in's methods, read by name.
	const sets = Set.prototype as unknown as Record<string, unknown>;
	if (!METHODS.every((name) => typeof sets[name] === "function")) loadSetMethods();
}
