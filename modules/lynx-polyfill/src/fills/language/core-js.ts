// The language fills that are core-js's modules. A module loads only where the method it fills is
// missing, and then installs it only where core-js's own check finds the engine's missing or wrong:
// an engine that has them all (JavaScriptCore runs a production iOS app's background) loads none,
// so core-js puts nothing on it, not even the store its modules share.

import { forceCoreJs, loadCoreJs } from "../vendor/core-js.js";
import type { CoreJsModule } from "../vendor/core-js.js";

/** A method a core-js module fills: the module, the object the method goes on, and its name. */
export type CoreJsFill = readonly [module: CoreJsModule, owner: object, name: PropertyKey];

/** Loads the module of each fill whose object lacks its method. */
export function fillFromCoreJs(fills: readonly CoreJsFill[]): void {
	for (const [module, owner, name] of fills)
		// Boundary: a built-in's method, read by name.
		if ((owner as Record<PropertyKey, unknown>)[name] === undefined) loadCoreJs(module);
}

/**
 * Loads `module` with core-js's own in place of `feature` (as core-js names it: `Reflect.apply`,
 * `String#matchAll`), when `works` finds the engine's wrong: core-js's own check may pass a
 * built-in that the fill's check fails.
 */
export function replaceFromCoreJs(module: CoreJsModule, feature: string, works: boolean): void {
	if (works) return;
	forceCoreJs(feature);
	loadCoreJs(module);
}
