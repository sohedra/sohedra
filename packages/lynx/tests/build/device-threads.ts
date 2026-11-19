// The scripts of a built page, run on the engine fake as a device runs them: each thread's script
// in a realm of its own, which has only what that thread has on a device. The thread tests run the
// sources in Node, where every global is at hand; this runs what the build made.
//
// The background: lynx-core loads the script, which registers a factory with `tt.define`, then
// calls it with `lynx`, the timers and the rest as its parameters (lynx-core's app.ts, `require`).
// The global object holds none of them, and no `queueMicrotask`.
//
// The main thread: Lynx's element functions and `lynx` are globals, and so are the timers, as a
// device showed. It has no `queueMicrotask`. `lynx.SystemInfo` is there; a global `SystemInfo` is
// not.
//
// Both threads lack what their engine (PrimJS) lacks, listed below, and the web's globals that no
// Lynx engine has: `EventTarget`, `structuredClone` and `performance`. Each realm starts without
// them, as a device's threads do, so whatever the page's scripts need of them, they bring.
//
// What a thread hands the other crosses as text, and is made again in the receiving realm. What the
// engine hands a thread is made in that thread's realm too: the main thread's element functions'
// answers, and the page's data as the background starts. Not yet: the event objects and lifecycle
// data the engine fake passes to a thread's listeners, and the data of the app's hooks, which keep
// this process's built-ins.

import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

import { RuntimeWrapperWebpackPlugin } from "@lynx-js/runtime-wrapper-webpack-plugin";
import { JSDOM } from "jsdom";

import { readGlobal } from "../../src/testing/globals.ts";
import { createEngine, startTestPage } from "../../src/testing/index.ts";
import type { BackgroundLynx, TestBundle, TestPage } from "../../src/testing/index.ts";
import { LAZY_BUNDLE_METHOD, PATCH_METHOD, RUN_FUNCTION } from "../../src/wire/index.ts";
import { readTemplate } from "./build-app.ts";
import type { AppBuild } from "./build-app.ts";

/** The built-ins seen missing on a device, on both threads, by the object that would hold them. */
const SEEN_MISSING: Readonly<Record<string, readonly string[]>> = {
	"Array.prototype": [
		"at",
		"findLast",
		"findLastIndex",
		"toSorted",
		"toReversed",
		"toSpliced",
		"with",
	],
	Array: ["fromAsync"],
	Object: ["hasOwn", "groupBy"],
	"String.prototype": ["at"],
	Promise: ["withResolvers"],
	globalThis: ["Intl"],
};

/** `%IteratorPrototype%`, which every iterator inherits from. */
const ITERATOR_PROTOTYPE = "Object.getPrototypeOf(Object.getPrototypeOf([][Symbol.iterator]()))";

/** The built-ins PrimJS's tables of built-ins lack (`js_array_proto_funcs` and the rest). */
const ABSENT_FROM_PRIMJS: Readonly<Record<string, readonly string[]>> = {
	"String.prototype": ["replaceAll", "isWellFormed", "toWellFormed"],
	Map: ["groupBy"],
	"Set.prototype": [
		"union",
		"intersection",
		"difference",
		"symmetricDifference",
		"isSubsetOf",
		"isSupersetOf",
		"isDisjointFrom",
	],
	[ITERATOR_PROTOTYPE]: [
		"map",
		"filter",
		"take",
		"drop",
		"flatMap",
		"reduce",
		"toArray",
		"forEach",
		"some",
		"every",
		"find",
	],
	Promise: ["try"],
	Error: ["isError"],
	RegExp: ["escape"],
	Math: ["sumPrecise"],
	globalThis: ["Iterator"],
};

/**
 * The web's globals that neither thread has: a fresh realm has none of them either, and taking them
 * away keeps it so.
 */
const NOT_ON_LYNX: Readonly<Record<string, readonly string[]>> = {
	globalThis: ["EventTarget", "structuredClone", "performance"],
};

/** Takes away, in a realm, the built-ins a device lacks. */
const WITHOUT_MISSING = [SEEN_MISSING, ABSENT_FROM_PRIMJS, NOT_ON_LYNX]
	.flatMap((missing) => Object.entries(missing))
	.flatMap(([owner, names]) => names.map((name) => `delete ${owner}.${name};`))
	.join("\n");

/**
 * Makes arrays and plain objects again in the realm it runs in, as that realm's own; anything
 * else, an element say, stays as it is.
 */
const ADOPT = `(function adopt(value) {
	if (Array.isArray(value)) return Array.from(value, (item) => adopt(item));
	if (typeof value !== "object" || value === null) return value;
	const prototype = Object.getPrototypeOf(value);
	if (prototype !== null && Object.getPrototypeOf(prototype) !== null) return value;
	const copy = {};
	for (const key of Object.keys(value)) copy[key] = adopt(value[key]);
	return copy;
})`;

/** A realm's `adopt`. */
type Adopt = (value: unknown) => unknown;

/** Globals a test sets on both threads before their scripts run, such as its spies. */
type Given = Readonly<Record<string, unknown>>;

/** What a device's main thread gives as `lynx.SystemInfo`. */
export const SYSTEM_INFO: Readonly<Record<string, unknown>> = {
	platform: "iOS",
	lynxSdkVersion: "4.2",
	pixelRatio: 3,
};

/**
 * The functions the main thread's script sets on its global object for the engine to call: they
 * reach the engine fake's globals, which it calls them on.
 */
const PAGE_FUNCTIONS = [
	PATCH_METHOD,
	LAZY_BUNDLE_METHOD,
	RUN_FUNCTION,
	"removeComponents",
	"updateGlobalProps",
	"processData",
];

/** Lynx's element functions, by name: the engine fake's. */
const ELEMENT_FUNCTIONS = Object.keys(
	createEngine({ document: new JSDOM("").window.document }).functions,
);

/**
 * A realm with the built-ins a device lacks taken away, and `globals` as its global object's, then
 * the test's own `given`.
 */
function realm(globals: object, given: Given): { context: vm.Context; adopt: Adopt } {
	const context = vm.createContext(globals);
	// Made before the built-ins go, from the realm's own `Array.from`, which a device has.
	const adopt = vm.runInContext(ADOPT, context) as Adopt;
	vm.runInContext(WITHOUT_MISSING, context);
	Object.assign(context, given);
	return { context, adopt };
}

/** The background's frame timer, as lynx-core gives it. The main thread's is the engine's. */
const requestAnimationFrame = (callback: (time: number) => void) =>
	setTimeout(() => callback(Date.now()), 16);

/**
 * The main thread's realm. Its element functions, its `lynx` and the functions its script sets
 * are the test page's, on the process's global object, where the engine fake finds them.
 */
function mainThreadRealm(given: Given): vm.Context {
	const globals = { setTimeout, clearTimeout };
	// Boundary: any name may be a global.
	const scope = globalThis as unknown as Record<string, unknown>;
	let adopt: Adopt = (value) => value;
	// Each element function of the engine fake, answering in the realm: one for each, so that a
	// function read twice is the same.
	const handedIn = new WeakMap<object, unknown>();
	const handIn = (value: unknown): unknown => {
		if (typeof value !== "function") return value;
		if (!handedIn.has(value))
			handedIn.set(value, (...args: unknown[]) => adopt(Reflect.apply(value, undefined, args)));
		return handedIn.get(value);
	};
	for (const name of [...ELEMENT_FUNCTIONS, "lynx", ...PAGE_FUNCTIONS]) {
		const element = ELEMENT_FUNCTIONS.includes(name);
		Object.defineProperty(globals, name, {
			get: () => (element ? handIn(readGlobal(name)) : readGlobal(name)),
			set: (value) => {
				scope[name] = value;
			},
			enumerable: true,
			configurable: true,
		});
	}
	const made = realm(globals, given);
	adopt = made.adopt;
	return made.context;
}

/** What lynx-core's `require` passes the factory after `require`, `module` and `exports`. */
function wrapperArguments(lynx: BackgroundLynx): unknown[] {
	const given: Record<string, unknown> = {
		setTimeout,
		setInterval,
		clearInterval,
		clearTimeout,
		console,
		lynx,
		requestAnimationFrame,
		cancelAnimationFrame: clearTimeout,
	};
	// Boundary: the plugin's default list is the array the wrapper's parameters are named from.
	const names = RuntimeWrapperWebpackPlugin.defaultOptions.injectVars as string[];
	return names.map((name) => given[name]);
}

/** What a script lynx-core loads leaves: the function that runs it with lynx-core's `tt`. */
interface ScriptHolder {
	init(inject: { tt: unknown }): unknown;
}

/** The background's realm, and how lynx-core runs a script there: the page's or a bundle's. */
interface BackgroundRealm {
	context: vm.Context;
	/** Runs a script that registers its factory as lynx-core does, and answers what it exports. */
	run(holder: ScriptHolder): unknown;
}

/**
 * Loads the background's script as lynx-core does, with `lynx` given to it alone. `modules` are
 * the scripts it may load by path, with `lynx.requireModule` and `lynx.requireModuleAsync`.
 */
function runBackground(
	script: string,
	lynx: BackgroundLynx,
	options: { given: Given; modules: Readonly<Record<string, string>> },
): BackgroundRealm {
	// The globals lynx-core seeds a page's realm with, which the page's scripts read
	// (lynx-core's common/nativeGlobal.ts, `seedPageGlobal`).
	const { context, adopt } = realm(
		{
			bundleSupportLoadScript: true,
			globDynamicComponentEntry: "__Card__",
			globComponentRegistPath: "",
		},
		options.given,
	);
	// The data the page was opened with, as lynx-core hands it to the page's script.
	const app = lynx.getApp();
	app._params = adopt(app._params) as typeof app._params;
	const factories = new Map<string, (...args: unknown[]) => void>();
	const required = new Map<string, unknown>();
	/**
	 * Runs a script as lynx-core loads one, and answers what its holder's `init` returns: the holder
	 * the script returns (`/app-service.js`), or else the one it leaves on the global object.
	 */
	const evaluate = (source: string, path: string): unknown => {
		const value = vm.runInContext(source, context, { filename: path }) as Partial<ScriptHolder>;
		// Boundary: the script leaves its factory's holder on the global object.
		return run(
			value?.init ? (value as ScriptHolder) : (context["__bundle__holder"] as ScriptHolder),
		);
	};
	const load = (path: string): unknown => {
		const source = options.modules[path];
		if (source === undefined)
			throw new Error(`The page's script loaded ${path}, which the build did not write.`);
		return evaluate(source, path);
	};
	// lynx-core's `lynx` also has the timers, and the engine's `Promise`, which the wrapper takes as
	// the script's own (lynx-core's lynx.ts); and loads a script by path, once (its `requireModule`,
	// `requireModuleAsync`).
	const deviceLynx = Object.assign(lynx, {
		Promise: vm.runInContext("Promise", context),
		setTimeout,
		clearTimeout,
		setInterval,
		clearInterval,
		requireModule(path: string): unknown {
			if (!required.has(path)) required.set(path, load(path));
			return required.get(path);
		},
		requireModuleAsync(path: string, callback: (error: unknown, exports?: unknown) => void): void {
			// Later, as a file loads; within the turn, which a test page's `settle()` waits for.
			void Promise.resolve().then(() => {
				let exports: unknown;
				try {
					exports = deviceLynx.requireModule(path);
				} catch (error) {
					callback(error);
					return;
				}
				callback(null, exports);
			});
		},
	});
	const tt = {
		define(path: string, factory: (...args: unknown[]) => void) {
			factories.set(path, factory);
		},
		require(path: string) {
			const module = { exports: {} };
			const require = (name: string) => {
				throw new Error(`The page's script required ${name}, which a device does not provide.`);
			};
			factories.get(path)!(require, module, module.exports, ...wrapperArguments(deviceLynx));
			return module.exports;
		},
	};
	// lynx-core runs a script's factory with its `tt` (lynx-core's app.ts, `_$executeInit`).
	const run = (loaded: ScriptHolder): unknown => loaded.init({ tt });
	evaluate(script, "background.js");
	return { context, run };
}

/** A lazy bundle's sections as the build wrote them, served at a URL. */
export interface DeviceBundle {
	/** The background section: a script lynx-core loads as it loads the page's. */
	background: string;
	/** The main-thread section: a function of the bundle's entry, as text; none when it is empty. */
	mainThread?: string;
	/** The bundle's style sheet, as the engine keeps it. */
	styles?: string;
}

/** A build's lazy bundles, each at the URL a page at `http://localhost:3000/` asks for. */
export function lazyBundlesOf(build: AppBuild): Record<string, DeviceBundle> {
	const bundles: Record<string, DeviceBundle> = {};
	for (const file of fs.readdirSync(path.join(build.dist, "out", "lazy-bundle"))) {
		const component = file.slice(0, file.indexOf(".svelte.") + ".svelte".length);
		const sections = readTemplate(build, `lazy-bundle/${component}`)["customSections"] as Record<
			string,
			{ content: unknown }
		>;
		const main = sections["main-thread"];
		const css = sections["CSS"];
		bundles[`http://localhost:3000/lazy-bundle/${file}`] = {
			background: sections["background"]!.content as string,
			...(main && { mainThread: main.content as string }),
			...(css && { styles: JSON.stringify(css.content) }),
		};
	}
	return bundles;
}

/** A page whose threads run the built scripts, each in its realm. */
export interface DevicePage {
	readonly page: TestPage;
	readonly mainThread: vm.Context;
	readonly background: vm.Context;
}

/** What a page on threads shaped like a device's starts with. */
export interface DevicePageOptions {
	/** Globals set on both threads before their scripts run, such as a test's spies. */
	globals?: Given;
	/** The page's address. */
	url?: string;
	/** Lazy bundles the page may load, by address. */
	bundles?: Record<string, DeviceBundle>;
	/**
	 * Scripts the background may load by path: the template's manifest (with `/app-service.js`, the
	 * page's background script when its chunks are split), and the chunks written as files.
	 */
	modules?: Record<string, string>;
}

/** Starts a page from a build's scripts, on threads shaped like a device's. */
export function startDevicePage(
	scripts: { mainThread: string; background: string },
	options: DevicePageOptions = {},
): DevicePage {
	const { globals = {} } = options;
	const { window } = new JSDOM("<!doctype html><body></body>");
	let mainThread: vm.Context | undefined;
	let background: BackgroundRealm | undefined;
	// Each section runs in its thread's realm, as the engine runs it there.
	const bundles: Record<string, TestBundle> = {};
	for (const [url, bundle] of Object.entries(options.bundles ?? {}))
		bundles[url] = {
			background: () =>
				background!.run(
					vm.runInContext(bundle.background, background!.context, {
						filename: `${url}/background.js`,
					}) as ScriptHolder,
				),
			...(bundle.mainThread !== undefined && {
				mainThread: () =>
					vm.runInContext(bundle.mainThread!, mainThread!, { filename: `${url}/main-thread.js` }),
			}),
			...(bundle.styles !== undefined && { styles: bundle.styles }),
		};
	const page = startTestPage({
		document: window.document,
		...(options.url !== undefined && { url: options.url }),
		bundles,
		mainThread: () => {
			Object.assign(readGlobal("lynx") as object, { SystemInfo: SYSTEM_INFO });
			mainThread = mainThreadRealm(globals);
			vm.runInContext(scripts.mainThread, mainThread, { filename: "main-thread.js" });
		},
		background: () => {
			const lynx = readGlobal("lynx") as BackgroundLynx;
			// lynx-core reports a script that throws as it loads ("loadCard failed").
			try {
				background = runBackground(scripts.background, lynx, {
					given: globals,
					modules: options.modules ?? {},
				});
			} catch (error) {
				lynx.reportError(error);
			}
		},
	});
	return { page, mainThread: mainThread!, background: background!.context };
}
