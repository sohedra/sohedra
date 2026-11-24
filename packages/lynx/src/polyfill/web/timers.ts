// The timers on the global object: WinterTC's Minimum Common API § 6 "The global scope", HTML
// § 8.6 "Timers". The background has them only as parameters of Lynx's runtime wrapper, which the
// bundle reads by name: `globalThis.setTimeout` is missing. Leaves out nothing; they are Lynx's.

import type { Scope, ThreadTimers } from "../globals.ts";
import { installEager } from "../install.ts";

/** @workaround web-global-timers kind=lynx-gap delete-when="Lynx's background thread has its timers on the global object" */
export function fillTimers(scope: Scope, timers: ThreadTimers): void {
	for (const [name, timer] of Object.entries(timers))
		if (typeof timer === "function") installEager(scope, name, timer);
}
