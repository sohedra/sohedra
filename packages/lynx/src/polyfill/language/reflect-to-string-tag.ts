// ES2020's `Reflect[Symbol.toStringTag]`, by core-js's module: ECMA-262 § 28.1.14, so
// `Object.prototype.toString.call(Reflect)` is `"[object Reflect]"`. Leaves out nothing.

import { globalScope } from "../globals.ts";
import { fillFromCoreJs } from "./core-js.ts";

/**
 * PrimJS lacks it on both threads.
 *
 * @workaround language-reflect-to-string-tag kind=lynx-gap delete-when="the engine of the oldest Lynx the binding supports has Reflect[Symbol.toStringTag]"
 */
export function fillReflectToStringTag(): void {
	// Boundary: the standard global, read by name here, as the folder never names it.
	const reflect = globalScope["Reflect"];
	if (typeof reflect === "object" && reflect !== null)
		fillFromCoreJs([["es.reflect.to-string-tag", reflect, Symbol.toStringTag]]);
}
