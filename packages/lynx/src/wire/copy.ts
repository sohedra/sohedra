// What crosses between the threads is JSON text, written here. JSON keeps strings, numbers,
// booleans, null, arrays and plain objects: `undefined` in an array, `NaN` and `Infinity` become
// `null`, `-0` becomes `0`, and `undefined` values and functions in an object are left out. A
// value JSON cannot hold (a cycle, a `BigInt`) fails where it is written.

import { wireError } from "./catalogue.ts";
import type { Thread } from "./names.ts";

/** `value` as the text sent to `thread`; a value that cannot be copied is the wire's error. */
export function toText(value: unknown, thread: Thread): string {
	try {
		return JSON.stringify(value);
	} catch (error) {
		throw wireError({
			code: "value_not_copyable",
			details: { thread, reason: error instanceof Error ? error.message : String(error) },
		});
	}
}
