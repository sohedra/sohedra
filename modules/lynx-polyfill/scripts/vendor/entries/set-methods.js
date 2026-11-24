// core-js's modules for ES2025's methods of `Set.prototype`. Each installs what its own check finds
// missing or wrong as it loads, so they load only when the fill calls in.
export function loadSetMethods() {
	require("core-js/modules/es.set.difference.v2.js");
	require("core-js/modules/es.set.intersection.v2.js");
	require("core-js/modules/es.set.is-disjoint-from.v2.js");
	require("core-js/modules/es.set.is-subset-of.v2.js");
	require("core-js/modules/es.set.is-superset-of.v2.js");
	require("core-js/modules/es.set.symmetric-difference.v2.js");
	require("core-js/modules/es.set.union.v2.js");
}
