// core-js's modules for ES2025's iterator helpers: the `Iterator` global, `Iterator.from` and the
// methods of `Iterator.prototype`. Each installs what its own check finds missing or wrong as it
// loads, so they load only when the fill calls in.
export function loadIteratorHelpers() {
	require("core-js/modules/es.iterator.constructor.js");
	require("core-js/modules/es.iterator.drop.js");
	require("core-js/modules/es.iterator.every.js");
	require("core-js/modules/es.iterator.filter.js");
	require("core-js/modules/es.iterator.find.js");
	require("core-js/modules/es.iterator.flat-map.js");
	require("core-js/modules/es.iterator.for-each.js");
	require("core-js/modules/es.iterator.from.js");
	require("core-js/modules/es.iterator.map.js");
	require("core-js/modules/es.iterator.reduce.js");
	require("core-js/modules/es.iterator.some.js");
	require("core-js/modules/es.iterator.take.js");
	require("core-js/modules/es.iterator.to-array.js");
}
