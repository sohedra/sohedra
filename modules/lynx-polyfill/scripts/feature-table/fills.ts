// What answers each row of the feature table (feature-table.json) that a Lynx thread lacks or gets
// wrong: an import of this package that fills it, Sohedra's binding (which fills what Svelte's
// runtime needs), or why nothing fills it. tests/contract/feature-table.test.ts holds the table and
// this list to each other: every "no" or "wrong" row has an answer here, every answer names a row of
// the table, and every import of the package answers at least one row. The README cites it.

/** Why nothing fills a row. */
export type Unfilled =
	/** Lynx lacks it for good: the docs and the binding's error name what to use instead. */
	| "exception"
	/** No JavaScript can give it on the engine. */
	| "unfillable"
	/** Past ES2025 (ES2026 or a proposal), which the package does not fill yet. */
	| "after-es2025"
	/** Syntax the app's build lowers to what the engine runs. */
	| "build-lowers"
	/** Syntax the app's build refuses with a message (`regexp_refused`). */
	| "build-refuses"
	/** A member of Lynx's own `lynx` object, not a standard global. */
	| "lynx-api"
	/** Not in WinterTC's Minimum Common API: a browser's window, its document and the like. */
	| "not-in-wintertc"
	/** A limit the docs name, which the fill does not lift. */
	| "documented-limit"
	/** A gap found but not planned for the first version: the after-port list. */
	| "after-port";

/** What answers a row. */
export type Answer =
	| {
			/** The package's imports that fill it: `""` is `@sohedra/lynx-polyfill` itself. */
			fills: string[];
			/** Whether Sohedra's binding fills it too, for Svelte's runtime. */
			binding?: true;
			/** What the import alone doesn't say. */
			note?: string;
	  }
	| { binding: true; note: string }
	| { unfilled: Unfilled; note: string };

/** Each answer, given to each of its rows. */
function rows(ids: readonly string[], answer: Answer): [string, Answer][] {
	return ids.map((id) => [id, answer]);
}

const language: Answer = { fills: ["/language"] };
const intl: Answer = {
	unfilled: "exception",
	note: "No Intl on Lynx: dates and numbers with date-fns or dayjs; the locale methods give fixed English output.",
};
const afterEs2025: Answer = {
	unfilled: "after-es2025",
	note: "ES2026 or a proposal: past the ES2025 the package fills.",
};
const resourceManagement: Answer = {
	unfilled: "after-es2025",
	note: "Explicit resource management (`using`, `Symbol.dispose`), ES2026.",
};
const lowered: Answer = {
	unfilled: "build-lowers",
	note: "The app's build (SWC) lowers it for both threads.",
};
const refusedRegExp: Answer = {
	unfilled: "build-refuses",
	note: "A literal, or a `RegExp` call with literal text, fails the build with `regexp_refused`; a pattern built at run time throws on the engine.",
};
const lynxApi: Answer = {
	unfilled: "lynx-api",
	note: "Lynx's own `lynx` member, not a standard global: the package fills the standard one.",
};
const promiseSpecies: Answer = {
	fills: ["/language"],
	note: "Background: lynx-core's `Promise` gets the ES2021 to ES2025 statics and `finally` from the package's bridge; its missing `Symbol.species` stays (documented-limit).",
};

/**
 * Every row of the feature table that a thread lacks or gets wrong, and what answers it. Rows that
 * every thread has are not here.
 */
export const ANSWERS: Readonly<Record<string, Answer>> = Object.fromEntries<Answer>([
	// The language: core-js's light fills and the package's own fixes.
	...rows(
		[
			"es.error.cause",
			"es.aggregate-error.cause",
			"es.array.at",
			"es.array.find-last",
			"es.array.find-last-index",
			"es.array.to-reversed",
			"es.array.to-sorted",
			"es.array.to-spliced",
			"es.array.with",
			"es.map.group-by",
			"es.object.get-own-property-descriptor",
			"es.object.group-by",
			"es.object.has-own",
			"es.promise.try",
			"es.promise.with-resolvers",
			"es.reflect.apply",
			"es.reflect.to-string-tag",
			"es.regexp.escape",
			"es.string.at-alternative",
			"es.string.is-well-formed",
			"es.string.match-all",
			"es.string.to-well-formed",
			"es.typed-array.at",
			"es.typed-array.to-reversed",
			"es.typed-array.to-sorted",
			"es.typed-array.with",
			"x.error.cause.option",
			"x.error.cause.own",
			"x.bigint",
			"why.object.gopd.primitive",
			"why.reflect.apply.no-args",
			"why.string.match-all.non-global",
			"why.bigint.as-uint-n",
			"why.aggregate-error.cause",
			"Object.hasOwn",
			"async.global.withResolvers",
			"async.global.try",
		],
		language,
	),
	["es.string.replace-all", { fills: ["/language"], binding: true }],
	["String.prototype.replaceAll", { fills: ["/language"], binding: true }],
	...rows(
		[
			"es.promise",
			"es.promise.all-settled",
			"es.promise.any",
			"es.promise.finally",
			"async.bundle.any",
			"async.bundle.withResolvers",
			"async.bundle.try",
		],
		promiseSpecies,
	),
	...rows(["es.object.assign", "why.object.assign.getter-defines"], {
		unfilled: "documented-limit",
		note: "PrimJS's `Object.assign` copies a key a getter made non-enumerable during the copy; it stays for speed, as core-js's is 5 to 7.5 times slower on PrimJS.",
	}),
	...rows(["why.promise.species", "why.promise.species-getter"], {
		unfilled: "documented-limit",
		note: "lynx-core's `Promise` has no `Symbol.species`: the bridge adds the statics without it, and subclassing it stays as lynx-core makes it.",
	}),
	// The heavy language fills, each its own import.
	...rows(
		[
			"es.iterator.constructor",
			"es.iterator.drop",
			"es.iterator.every",
			"es.iterator.filter",
			"es.iterator.find",
			"es.iterator.flat-map",
			"es.iterator.for-each",
			"es.iterator.from",
			"es.iterator.map",
			"es.iterator.reduce",
			"es.iterator.some",
			"es.iterator.take",
			"es.iterator.to-array",
		],
		{ fills: ["/iterator-helpers"] },
	),
	...rows(
		[
			"es.set.difference.v2",
			"es.set.intersection.v2",
			"es.set.is-disjoint-from.v2",
			"es.set.is-subset-of.v2",
			"es.set.is-superset-of.v2",
			"es.set.symmetric-difference.v2",
			"es.set.union.v2",
		],
		{ fills: ["/set-methods"] },
	),
	...rows(["es.data-view.get-float16", "es.data-view.set-float16", "es.math.f16round"], {
		fills: ["/float16"],
	}),
	...rows(["x.string.normalize", "x.string.normalize.nfc"], { fills: ["/normalize"] }),
	// Past ES2025.
	...rows(
		[
			"es.error.is-error",
			"es.iterator.chunks",
			"es.iterator.concat",
			"es.iterator.includes",
			"es.iterator.join",
			"es.iterator.windows",
			"es.iterator.zip",
			"es.iterator.zip-keyed",
			"es.json.is-raw-json",
			"es.json.raw-json",
			"es.map.get-or-insert",
			"es.map.get-or-insert-computed",
			"es.weak-map.get-or-insert",
			"es.weak-map.get-or-insert-computed",
			"es.math.sum-precise",
			"es.array.from-async",
			"es.uint8-array.from-base64",
			"es.uint8-array.from-hex",
			"es.uint8-array.set-from-base64",
			"es.uint8-array.set-from-hex",
			"es.uint8-array.to-base64",
			"es.uint8-array.to-hex",
		],
		afterEs2025,
	),
	...rows(["es.json.parse", "es.json.stringify", "why.json.parse.source"], {
		unfilled: "after-es2025",
		note: "core-js's check fails only on `JSON.rawJSON` and the reviver's `context.source`, past ES2025. PrimJS's own JSON bugs (an escaped \\u0000 in `JSON.parse`, tiny numbers and BigInt in `JSON.stringify`, objects written through `Array.prototype`'s setters) are on the after-port list, with test262 rows.",
	}),
	...rows(
		[
			"es.symbol.async-dispose",
			"es.symbol.dispose",
			"es.suppressed-error.constructor",
			"es.disposable-stack.constructor",
			"es.async-disposable-stack.constructor",
			"es.iterator.dispose",
			"es.async-iterator.async-dispose",
			"syn.using",
			"syn.await-using",
		],
		resourceManagement,
	),
	// What no JavaScript gives on the engine.
	...rows(
		[
			"es.array-buffer.detached",
			"es.array-buffer.transfer",
			"es.array-buffer.transfer-to-fixed-length",
			"x.array-buffer.transfer.smoke",
			"x.array-buffer.resizable",
			"x.shared-array-buffer.growable",
			"x.atomics",
			"x.atomics.wait-async",
			"x.weak-map.symbol-keys",
			"x.weak-set.symbol-keys",
			"x.weak-ref.symbol-target",
		],
		{
			unfilled: "unfillable",
			note: "The engine's buffers, atomics and weak collections: JavaScript can't add them.",
		},
	),
	[
		"x.error.capture-stack-trace",
		{
			unfilled: "after-port",
			note: "`Error.captureStackTrace`: a fill or an exception, open for the owner.",
		},
	],
	// Intl, and the locale methods under it.
	...rows(
		[
			"x.intl",
			"x.intl.number-format",
			"x.intl.date-time-format",
			"x.intl.collator",
			"x.intl.plural-rules",
			"x.intl.relative-time-format",
			"x.intl.list-format",
			"x.intl.segmenter",
			"x.intl.locale",
			"x.intl.display-names",
			"x.intl.get-canonical-locales",
			"x.intl.supported-values-of",
			"x.string.locale-upper-tr",
			"x.string.locale-compare",
			"x.number.to-locale-string-de",
			"x.date.to-locale-date-string-utc",
			"Intl",
		],
		intl,
	),
	// Syntax.
	...rows(
		[
			"syn.regexp-unicode-property-literal",
			"syn.regexp-unicode-property-script",
			"syn.logical-assign-nullish",
			"syn.logical-assign-or",
			"syn.logical-assign-and",
			"syn.class-private-in",
			"syn.class-static-block",
		],
		lowered,
	),
	[
		"syn.regexp-unicode-property-ctor",
		{
			unfilled: "documented-limit",
			note: "A `\\p{…}` pattern built at run time: the build lowers only what it sees, and PrimJS has no Unicode tables.",
		},
	],
	...rows(
		[
			"syn.regexp-d-literal",
			"syn.regexp-d-ctor",
			"syn.regexp-v-literal",
			"syn.regexp-v-ctor",
			"syn.regexp-v-ctor-simple",
			"syn.regexp-modifiers-literal",
			"syn.regexp-modifiers-ctor",
			"syn.regexp-duplicate-named-groups-literal",
			"syn.regexp-duplicate-named-groups-ctor",
		],
		refusedRegExp,
	),
	// The web.
	...rows(["URL", "URLSearchParams"], { fills: ["/url"] }),
	...rows(["atob", "btoa"], { fills: ["/base64"] }),
	...rows(["TextEncoder", "TextDecoder"], { fills: ["/encoding"] }),
	["structuredClone", { fills: ["/structured-clone"], binding: true }],
	["EventTarget", { fills: ["/events"], binding: true }],
	...rows(["DOMException", "Event", "CustomEvent", "reportError", "addEventListener", "onerror"], {
		fills: ["/events"],
	}),
	[
		"onunhandledrejection",
		{
			unfilled: "documented-limit",
			note: "Neither thread tells JavaScript of a rejection nobody handled, and WinterTC § 6 says a runtime that can't fire the event must not offer the handler.",
		},
	],
	["queueMicrotask", { fills: [""], binding: true }],
	[
		"performance",
		{
			fills: ["/performance"],
			binding: true,
			note: "The binding gives the background's `now` and `timeOrigin` only, for Svelte's motion.",
		},
	],
	...rows(["self", "navigator"], { fills: [""] }),
	["console", { fills: [""], note: "`console.trace` and `console.assert`." }],
	...rows(
		["AbortController", "AbortSignal", "async.AbortSignal.timeout", "async.AbortSignal.any"],
		{
			fills: ["/abort"],
		},
	),
	...rows(
		[
			"fetch",
			"Headers",
			"Request",
			"Response",
			"Blob",
			"File",
			"FormData",
			"async.Response.text",
			"async.Response.json-static",
		],
		{ fills: ["/fetch"] },
	),
	...rows(
		[
			"ReadableStream",
			"WritableStream",
			"TransformStream",
			"TextEncoderStream",
			"TextDecoderStream",
			"async.ReadableStream.read",
		],
		{ fills: ["/streams"] },
	),
	["CompressionStream", { fills: ["/compression"] }],
	["EventSource", { fills: ["/event-source"] }],
	["URLPattern", { fills: ["/url-pattern"] }],
	["MessageChannel", { fills: ["/messaging"] }],
	[
		"SystemInfo",
		{
			binding: true,
			note: "A Lynx global: the binding copies `lynx.SystemInfo` to the main thread's.",
		},
	],
	...rows(
		[
			"lynx.EventSource",
			"lynx.queueMicrotask",
			"lynx.Promise",
			"lynx.SystemInfo",
			"TextCodecHelper",
			"async.lynx.queueMicrotask.order",
		],
		lynxApi,
	),
	...rows(["crypto", "WebAssembly", "WebSocket", "__WebSocket__", "matchMedia", "localStorage"], {
		unfilled: "exception",
		note: "Lynx lacks it for good: the docs and the binding's error for the missing global name what to use instead.",
	}),
	...rows(["window", "document", "XMLHttpRequest", "FileReader", "sessionStorage"], {
		unfilled: "not-in-wintertc",
		note: "A browser's, not in WinterTC's Minimum Common API.",
	}),
	...rows(["BroadcastChannel", "setImmediate", "requestIdleCallback"], {
		unfilled: "after-port",
		note: "Open for the owner: an exception, or a fill later.",
	}),
]);
