// The types of core-js.js, which scripts/polyfill/bundle.ts writes from core-js.

/** A core-js module the language fills load, by core-js's name. */
export type CoreJsModule =
	| "es.aggregate-error.cause"
	| "es.array.at"
	| "es.array.find-last"
	| "es.array.find-last-index"
	| "es.array.to-reversed"
	| "es.array.to-sorted"
	| "es.array.to-spliced"
	| "es.array.with"
	| "es.error.cause"
	| "es.map.group-by"
	| "es.object.assign"
	| "es.object.get-own-property-descriptor"
	| "es.object.group-by"
	| "es.object.has-own"
	| "es.promise.try"
	| "es.promise.with-resolvers"
	| "es.reflect.apply"
	| "es.reflect.to-string-tag"
	| "es.regexp.escape"
	| "es.string.at-alternative"
	| "es.string.is-well-formed"
	| "es.string.match-all"
	| "es.string.replace-all"
	| "es.string.to-well-formed"
	| "es.typed-array.at"
	| "es.typed-array.to-reversed"
	| "es.typed-array.to-sorted"
	| "es.typed-array.with";

/** Loads the core-js module `name`, once: it installs what its check finds missing or wrong. */
export function loadCoreJs(name: CoreJsModule): void;

/**
 * Makes core-js put its own in place of `feature` (as core-js names it: `Object.assign`,
 * `String#matchAll`), whatever its own check finds. Called before the module loads.
 */
export function forceCoreJs(feature: string): void;
