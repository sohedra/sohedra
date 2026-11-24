// core-js's modules for ES2025's half-precision numbers: `Math.f16round` and `DataView`'s
// `getFloat16` and `setFloat16` (core-js has no `Float16Array`). Each installs what its own check
// finds missing or wrong as it loads, so they load only when the fill calls in.
export function loadFloat16() {
	require("core-js/modules/es.math.f16round.js");
	require("core-js/modules/es.data-view.get-float16.js");
	require("core-js/modules/es.data-view.set-float16.js");
}
