// The built-ins PrimJS has and gets wrong, each replaced by core-js's own only where a check of what
// it gets wrong fails: `Object.getOwnPropertyDescriptor` (ECMA-262 § 20.1.2.8: no `ToObject` of a
// primitive), `Reflect.apply` (§ 28.1.1: no list of arguments, no `TypeError`) and
// `String.prototype.matchAll` (§ 22.1.3.14: a regular expression that is not global, no
// `TypeError`). Its `JSON.stringify` passes ES2025's checks, so it stays. Its `Object.assign` stays
// too, for speed (core-js's is 5 to 7.5 times slower on PrimJS): it copies a key a getter made
// non-enumerable during the copy (§ 20.1.2.1), which the README names as a known limit.

import { globalScope } from "../globals.ts";
import { holds } from "../install.ts";
import { replaceFromCoreJs } from "./core-js.ts";

/**
 * Wrong on both threads.
 *
 * @workaround language-wrong-built-ins kind=lynx-bug delete-when="the engine of the oldest Lynx the package supports gets Object.getOwnPropertyDescriptor, Reflect.apply and String.prototype.matchAll right"
 */
export function fillWrongBuiltIns(): void {
	replaceFromCoreJs(
		"es.object.get-own-property-descriptor",
		"Object.getOwnPropertyDescriptor",
		holds(() => Object.getOwnPropertyDescriptor("q", "0")?.value === "q"),
	);
	// Boundary: the standard global, read by name here, as the folder never names it.
	const reflect = globalScope["Reflect"] as { apply?: (target: unknown) => unknown } | undefined;
	const apply = reflect?.apply;
	replaceFromCoreJs(
		"es.reflect.apply",
		"Reflect.apply",
		typeof apply === "function" && throwsTypeError(() => apply(() => {})),
	);
	replaceFromCoreJs(
		"es.string.match-all",
		"String#matchAll",
		typeof String.prototype.matchAll === "function" &&
			// oxlint-disable-next-line oxc/bad-match-all-arg -- the check: the standard refuses it
			throwsTypeError(() => "a".matchAll(/./)),
	);
}

/** Whether `run` throws a `TypeError`. */
function throwsTypeError(run: () => unknown): boolean {
	try {
		run();
	} catch (error) {
		return error instanceof TypeError;
	}
	return false;
}
