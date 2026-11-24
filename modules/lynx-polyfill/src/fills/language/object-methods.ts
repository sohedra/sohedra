// ES2022's `Object.hasOwn` and ES2024's `Object.groupBy` and `Map.groupBy`, by core-js's modules:
// ECMA-262 § 20.1.2 and § 24.1.2. Leaves out nothing.

import { fillFromCoreJs } from "./core-js.ts";

/**
 * PrimJS lacks them on both threads.
 *
 * @workaround language-object-methods kind=lynx-gap delete-when="the engine of the oldest Lynx the package supports has Object.hasOwn, Object.groupBy and Map.groupBy"
 */
export function fillObjectMethods(): void {
	fillFromCoreJs([
		["es.object.has-own", Object, "hasOwn"],
		["es.object.group-by", Object, "groupBy"],
		["es.map.group-by", Map, "groupBy"],
	]);
}
