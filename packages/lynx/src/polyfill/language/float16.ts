// ES2025's half-precision numbers, by core-js's modules: ECMA-262 § 21.3.2 (`Math.f16round`) and
// § 25.3.4 (`DataView.prototype.getFloat16` and `setFloat16`). Leaves out `Float16Array`, which
// core-js has none of: a typed array's elements need the engine. Not in a thread's list: a thread's
// script gets it when its code names them.

import { loadFloat16 } from "../vendor/float16.js";

/**
 * PrimJS lacks them on both threads.
 *
 * @workaround language-float16 kind=lynx-gap delete-when="the engine of the oldest Lynx the binding supports has Math.f16round and DataView's getFloat16 and setFloat16"
 */
export function fillFloat16(): void {
	// Boundary: built-ins' methods, read by name.
	const math = Math as unknown as Record<string, unknown>;
	const views = DataView.prototype as unknown as Record<string, unknown>;
	const has = [math["f16round"], views["getFloat16"], views["setFloat16"]].every(
		(method) => typeof method === "function",
	);
	if (!has) loadFloat16();
}
