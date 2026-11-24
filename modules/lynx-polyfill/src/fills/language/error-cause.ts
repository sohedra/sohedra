// ES2022's `cause` option of the error constructors, by core-js's modules: ECMA-262 § 20.5
// (`InstallErrorCause`), for `Error`, its six native errors and `AggregateError`. core-js wraps
// each constructor, so `Error` is core-js's function, with the engine's `Error.prototype`.

import { holds } from "../install.ts";
import { loadCoreJs } from "../vendor/core-js.js";

/**
 * PrimJS ignores the option on both threads.
 *
 * @workaround language-error-cause kind=lynx-gap delete-when="the engine of the oldest Lynx the package supports keeps the cause option of Error and AggregateError"
 */
export function fillErrorCause(): void {
	if (!holds(() => new Error(undefined, { cause: 7 }).cause === 7)) loadCoreJs("es.error.cause");
	if (!holds(() => new AggregateError([], undefined, { cause: 7 }).cause === 7))
		loadCoreJs("es.aggregate-error.cause");
}
