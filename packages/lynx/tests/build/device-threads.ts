// The scripts of a built page, run on the engine fake as a device runs them: each thread's script
// in a realm of its own, which has only what that thread has on a device. The thread tests run the
// sources in Node, where every global is at hand; this runs what the build made.
//
// The background: lynx-core loads the script, which registers a factory with `tt.define`, then
// calls it with `lynx`, the timers and the rest as its parameters (lynx-core's app.ts, `require`).
// The global object holds none of them, and no `queueMicrotask`.
//
// The main thread: Lynx's element functions and `lynx` are globals, and so are the timers and
// `queueMicrotask`, as a device showed. `lynx.SystemInfo` is there; a global `SystemInfo` is not.
//
// Both threads lack what their engine (PrimJS) lacks, listed below, and neither has `performance`.
// An app gets none of these from the binding, and Svelte's runtime and the binding must run without
// them.
//
// What a thread hands the other crosses as text, and is made again in the receiving realm. What the
// engine hands a thread is made in that thread's realm too: the main thread's element functions'
// answers, and the page's data as the background starts. Not yet: the event objects and lifecycle
// data the engine fake passes to a thread's listeners, and the data of the app's hooks, which keep
// this process's built-ins.

import vm from "node:vm";

import { RuntimeWrapperWebpackPlugin } from "@lynx-js/runtime-wrapper-webpack-plugin";
import { JSDOM } from "jsdom";

import { readGlobal } from "../../src/testing/globals.ts";
import { createEngine, startTestPage } from "../../src/testing/index.ts";
import type { BackgroundLynx, TestPage } from "../../src/testing/index.ts";
import { PATCH_METHOD } from "../../src/wire/index.ts";

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

/** Takes away, in a realm, the built-ins a device lacks. */
const WITHOUT_MISSING = [SEEN_MISSING, ABSENT_FROM_PRIMJS]
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
const PAGE_FUNCTIONS = [PATCH_METHOD, "removeComponents", "updateGlobalProps", "processData"];

/** Lynx's element functions, by name: the engine fake's. */
const ELEMENT_FUNCTIONS = Object.keys(
	createEngine({ document: new JSDOM("").window.document }).functions,
);

/** A realm with the built-ins a device lacks taken away, and `globals` as its global object's. */
function realm(globals: object): { context: vm.Context; adopt: Adopt } {
	const context = vm.createContext(globals);
	// Made before the built-ins go, from the realm's own `Array.from`, which a device has.
	const adopt = vm.runInContext(ADOPT, context) as Adopt;
	vm.runInContext(WITHOUT_MISSING, context);
	return { context, adopt };
}

/** A frame's timer, as a device gives it. */
const requestAnimationFrame = (callback: (time: number) => void) =>
	setTimeout(() => callback(Date.now()), 16);

/**
 * The main thread's realm. Its element functions, its `lynx` and the functions its script sets
 * are the test page's, on the process's global object, where the engine fake finds them.
 */
function mainThreadRealm(): vm.Context {
	const globals = { setTimeout, clearTimeout, queueMicrotask, requestAnimationFrame };
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
	const made = realm(globals);
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

/** Loads the background's script as lynx-core does, with `lynx` given to it alone. */
function runBackground(script: string, lynx: BackgroundLynx): vm.Context {
	const { context, adopt } = realm({ bundleSupportLoadScript: true });
	// The data the page was opened with, as lynx-core hands it to the page's script.
	const app = lynx.getApp();
	app._params = adopt(app._params) as typeof app._params;
	vm.runInContext(script, context, { filename: "background.js" });
	// Boundary: the script leaves its factory's holder on the global object.
	const holder = context["__bundle__holder"] as { init(inject: { tt: unknown }): unknown };
	const factories = new Map<string, (...args: unknown[]) => void>();
	// lynx-core's `lynx` also has the timers, and the engine's `Promise`, which the wrapper takes as
	// the script's own (lynx-core's lynx.ts).
	const deviceLynx = Object.assign(lynx, {
		Promise: vm.runInContext("Promise", context),
		setTimeout,
		clearTimeout,
		setInterval,
		clearInterval,
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
	holder.init({ tt });
	return context;
}

/** A page whose threads run the built scripts, each in its realm. */
export interface DevicePage {
	readonly page: TestPage;
	readonly mainThread: vm.Context;
	readonly background: vm.Context;
}

/** Starts a page from a build's scripts, on threads shaped like a device's. */
export function startDevicePage(scripts: { mainThread: string; background: string }): DevicePage {
	const { window } = new JSDOM("<!doctype html><body></body>");
	let mainThread: vm.Context | undefined;
	let background: vm.Context | undefined;
	const page = startTestPage({
		document: window.document,
		mainThread: () => {
			Object.assign(readGlobal("lynx") as object, { SystemInfo: SYSTEM_INFO });
			mainThread = mainThreadRealm();
			vm.runInContext(scripts.mainThread, mainThread, { filename: "main-thread.js" });
		},
		background: () => {
			const lynx = readGlobal("lynx") as BackgroundLynx;
			// lynx-core reports a script that throws as it loads ("loadCard failed").
			try {
				background = runBackground(scripts.background, lynx);
			} catch (error) {
				lynx.reportError(error);
			}
		},
	});
	return { page, mainThread: mainThread!, background: background! };
}
