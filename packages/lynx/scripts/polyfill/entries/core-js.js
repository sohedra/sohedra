// core-js's modules for the language fills of both threads, by core-js's name. A core-js module
// installs its methods as it loads, where its own check finds the engine's missing or wrong, so each
// loads only when a fill asks for it by name.
import isForced from "core-js/internals/is-forced.js";

const MODULES = {
	"es.aggregate-error.cause": () => require("core-js/modules/es.aggregate-error.cause.js"),
	"es.array.at": () => require("core-js/modules/es.array.at.js"),
	"es.array.find-last": () => require("core-js/modules/es.array.find-last.js"),
	"es.array.find-last-index": () => require("core-js/modules/es.array.find-last-index.js"),
	"es.array.to-reversed": () => require("core-js/modules/es.array.to-reversed.js"),
	"es.array.to-sorted": () => require("core-js/modules/es.array.to-sorted.js"),
	"es.array.to-spliced": () => require("core-js/modules/es.array.to-spliced.js"),
	"es.array.with": () => require("core-js/modules/es.array.with.js"),
	"es.error.cause": () => require("core-js/modules/es.error.cause.js"),
	"es.map.group-by": () => require("core-js/modules/es.map.group-by.js"),
	"es.object.assign": () => require("core-js/modules/es.object.assign.js"),
	"es.object.get-own-property-descriptor": () =>
		require("core-js/modules/es.object.get-own-property-descriptor.js"),
	"es.object.group-by": () => require("core-js/modules/es.object.group-by.js"),
	"es.object.has-own": () => require("core-js/modules/es.object.has-own.js"),
	"es.promise.try": () => require("core-js/modules/es.promise.try.js"),
	"es.promise.with-resolvers": () => require("core-js/modules/es.promise.with-resolvers.js"),
	"es.reflect.apply": () => require("core-js/modules/es.reflect.apply.js"),
	"es.regexp.escape": () => require("core-js/modules/es.regexp.escape.js"),
	"es.string.at-alternative": () => require("core-js/modules/es.string.at-alternative.js"),
	"es.string.is-well-formed": () => require("core-js/modules/es.string.is-well-formed.js"),
	"es.string.match-all": () => require("core-js/modules/es.string.match-all.js"),
	"es.string.replace-all": () => require("core-js/modules/es.string.replace-all.js"),
	"es.string.to-well-formed": () => require("core-js/modules/es.string.to-well-formed.js"),
	"es.typed-array.at": () => require("core-js/modules/es.typed-array.at.js"),
	"es.typed-array.to-reversed": () => require("core-js/modules/es.typed-array.to-reversed.js"),
	"es.typed-array.to-sorted": () => require("core-js/modules/es.typed-array.to-sorted.js"),
	"es.typed-array.with": () => require("core-js/modules/es.typed-array.with.js"),
};

/** Loads the core-js module `name`, once: it installs what its check finds missing or wrong. */
export function loadCoreJs(name) {
	MODULES[name]();
}

/**
 * Makes core-js put its own in place of `feature` (as core-js names it: `Object.assign`,
 * `String#matchAll`), whatever its own check finds: for a built-in a fill's check found wrong.
 * Called before the module loads.
 */
export function forceCoreJs(feature) {
	isForced.data[isForced.normalize(feature)] = isForced.POLYFILL;
}
