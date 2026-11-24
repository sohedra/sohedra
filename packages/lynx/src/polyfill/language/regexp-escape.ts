// ES2025's `RegExp.escape`, by core-js's module: ECMA-262 § 22.2.5. Leaves out nothing.

import { fillFromCoreJs } from "./core-js.ts";

/**
 * PrimJS lacks it on both threads.
 *
 * @workaround language-regexp-escape kind=lynx-gap delete-when="the engine of the oldest Lynx the binding supports has RegExp.escape"
 */
export function fillRegExpEscape(): void {
	fillFromCoreJs([["es.regexp.escape", RegExp, "escape"]]);
}
