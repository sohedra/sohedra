// ES2024's `Promise.withResolvers` and ES2025's `Promise.try` on the engine's `Promise`, by
// core-js's modules: ECMA-262 § 27.2.4. The background's bundle names lynx-core's `Promise`
// instead (lynx-promise.ts fills that one); the engine's is the one `async` functions return.
// Leaves out nothing.

import { globalScope } from "../globals.ts";
import { fillFromCoreJs } from "./core-js.ts";

/**
 * PrimJS lacks them on both threads.
 *
 * @workaround language-promise-statics kind=lynx-gap delete-when="the engine of the oldest Lynx the package supports has Promise.withResolvers and Promise.try"
 */
export function fillPromiseStatics(): void {
	// Boundary: the engine's own `Promise`, which the background's bundle does not name.
	const engine = globalScope["Promise"] as object;
	fillFromCoreJs([
		["es.promise.with-resolvers", engine, "withResolvers"],
		["es.promise.try", engine, "try"],
	]);
}
