// ES2021's to ES2024's methods of strings, by core-js's modules: ECMA-262 § 22.1.3 (`at`,
// `isWellFormed`, `replaceAll`, `toWellFormed`). Leaves out nothing.

import { fillFromCoreJs } from "./core-js.ts";

/**
 * PrimJS lacks them on both threads. Svelte's runtime strips the comments of a `style` attribute
 * with `replaceAll` when the element also has a `style:` directive.
 *
 * @workaround language-string-methods kind=lynx-gap delete-when="the engine of the oldest Lynx the package supports has ES2024's methods of strings"
 */
export function fillStringMethods(): void {
	const strings = String.prototype;
	fillFromCoreJs([
		["es.string.at-alternative", strings, "at"],
		["es.string.is-well-formed", strings, "isWellFormed"],
		["es.string.replace-all", strings, "replaceAll"],
		["es.string.to-well-formed", strings, "toWellFormed"],
	]);
}
