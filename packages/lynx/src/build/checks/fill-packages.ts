// Packages other than `@sohedra/lynx-polyfill` that put globals on the global object as they load,
// by the file that installs them. An app whose build holds one of these files fills those globals,
// as it would with the polyfill's import. A file is matched by its path under `node_modules`, so an
// entry that reaches it through others (`core-js/stable` loads `core-js/modules/web.url.js`) counts
// too. Each row names its source, read in the package's own files at the version given.
//
// Left out on purpose: `text-encoding` 0.7.0 installs on its module's `this` (lib/encoding.js's
// last line), which a bundler makes the module's exports, not the global object; and
// `@ungap/structured-clone` 1.4.0 exports a function and installs nothing (esm/index.js).

/** A file of a package, and the globals it installs. */
interface FillFile {
	/** The package. */
	package: string;
	/** The file's path in the package, without its extension. */
	files: readonly string[];
	globals: readonly string[];
}

/** The files that install globals, with their source. */
const FILL_FILES: readonly FillFile[] = [
	// core-js 3.51.0: each `modules/web.*` and `modules/es.*` file defines its global on
	// `internals/global-this` (`$({ global: true … })`); every entry (`core-js`, `core-js/stable`,
	// `/actual`, `/full`, `/es`, `/web`, `core-js/stable/url`…) loads these modules.
	{ package: "core-js", files: ["modules/web.url.constructor"], globals: ["URL"] },
	{
		package: "core-js",
		files: ["modules/web.url-search-params.constructor"],
		globals: ["URLSearchParams"],
	},
	{ package: "core-js", files: ["modules/web.structured-clone"], globals: ["structuredClone"] },
	{ package: "core-js", files: ["modules/web.queue-microtask"], globals: ["queueMicrotask"] },
	{ package: "core-js", files: ["modules/web.atob"], globals: ["atob"] },
	{ package: "core-js", files: ["modules/web.btoa"], globals: ["btoa"] },
	{ package: "core-js", files: ["modules/web.self"], globals: ["self"] },
	{
		package: "core-js",
		files: ["modules/web.dom-exception.constructor"],
		globals: ["DOMException"],
	},
	{ package: "core-js", files: ["modules/es.iterator.constructor"], globals: ["Iterator"] },
	// fast-text-encoding 1.0.6: text.min.js sets `scope.TextEncoder` and `scope.TextDecoder` on
	// `window`, else `global`.
	{ package: "fast-text-encoding", files: ["text.min"], globals: ["TextEncoder", "TextDecoder"] },
	// abortcontroller-polyfill 1.7.8: these dist files set `self.AbortController` and
	// `self.AbortSignal`; its `cjs-ponyfill` and `abortsignal-ponyfill` install nothing.
	{
		package: "abortcontroller-polyfill",
		files: [
			"dist/umd-polyfill",
			"dist/polyfill-patch-fetch",
			"dist/abortcontroller-polyfill-only",
			"dist/abortsignal-polyfill-only",
		],
		globals: ["AbortController", "AbortSignal"],
	},
	// whatwg-fetch 3.6.20: fetch.js and dist/fetch.umd.js set `fetch`, `Headers`, `Request` and
	// `Response` on the global object where it has no `fetch`.
	{
		package: "whatwg-fetch",
		files: ["fetch", "dist/fetch.umd"],
		globals: ["fetch", "Headers", "Request", "Response"],
	},
	// url-polyfill 1.1.14: url-polyfill.js sets `global.URL` and `global.URLSearchParams`.
	{
		package: "url-polyfill",
		files: ["url-polyfill", "url-polyfill.min"],
		globals: ["URL", "URLSearchParams"],
	},
	// web-streams-polyfill 4.5.1: its `/polyfill` entries define the streams' classes on the global
	// object (dist/polyfill.js); its main entry is a ponyfill and installs nothing.
	{
		package: "web-streams-polyfill",
		files: ["dist/polyfill", "dist/polyfill.es5", "dist/polyfill.min", "dist/polyfill.es5.min"],
		globals: [
			"ReadableStream",
			"ReadableStreamDefaultController",
			"ReadableByteStreamController",
			"ReadableStreamBYOBRequest",
			"ReadableStreamDefaultReader",
			"ReadableStreamBYOBReader",
			"WritableStream",
			"WritableStreamDefaultController",
			"WritableStreamDefaultWriter",
			"ByteLengthQueuingStrategy",
			"CountQueuingStrategy",
			"TransformStream",
			"TransformStreamDefaultController",
		],
	},
];

/** The globals the file `resource` installs as it loads, if it is one of the table's. */
export function globalsInstalledBy(resource: string): readonly string[] {
	const path = resource.replace(/\\/g, "/").replace(/\.[cm]?js$/, "");
	for (const fill of FILL_FILES)
		for (const file of fill.files)
			if (path.endsWith(`/node_modules/${fill.package}/${file}`)) return fill.globals;
	return [];
}
