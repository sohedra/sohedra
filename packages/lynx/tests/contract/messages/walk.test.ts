// A walk across the binding's seven catalogues: their codes are its docs pages, one namespace under
// `https://sohedra.com/e/`, so no two entries share one; every name a fix line gives the developer
// works; and no message of the binding is written outside a catalogue.

import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "@rstest/core";
import ts from "typescript";

import packageJson from "../../../package.json" with { type: "json" };
import { ANY_DETAILS, CATALOGUES } from "./catalogues.ts";

const SOURCE = path.resolve(import.meta.dirname, "../../../src");

/** Every entry of every catalogue, with its program and code. */
const ENTRIES = Object.entries(CATALOGUES).flatMap(([program, catalogue]) =>
	Object.entries(catalogue).map(([code, entry]) => ({ program, code, entry })),
);

/**
 * Codes that name one error on two threads, with one docs page and one sentence: a call made on a
 * page that has gone rejects with this code on the thread it was made on.
 */
const ON_BOTH_THREADS = new Set(["page_is_gone"]);

describe("the codes of the seven catalogues", () => {
	it("are unique across them, as their docs pages are", () => {
		const seen = new Map<string, string>();
		const clashes: string[] = [];
		for (const { program, code, entry } of ENTRIES) {
			for (const name of new Set([code, entry.docs])) {
				const before = seen.get(name);
				if (before !== undefined && before !== `${program}:${code}` && !ON_BOTH_THREADS.has(name))
					clashes.push(`${name}: ${before} and ${program}:${code}`);
				seen.set(name, `${program}:${code}`);
			}
		}
		expect(clashes).toEqual([]);
	});

	it("shared by two threads say the same sentence there", () => {
		for (const code of ON_BOTH_THREADS) {
			const sentences = ENTRIES.filter((each) => each.code === code).map(({ entry }) =>
				entry.message(ANY_DETAILS),
			);
			expect(sentences.length, code).toBe(2);
			expect(new Set(sentences).size, code).toBe(1);
		}
	});
});

/**
 * The package's public entries a fix line may name, by the name a developer imports, as the file
 * whose types an app reads. Their exports are read from the types: the runtime modules need a
 * thread's build to load.
 */
const OWN_ENTRIES: Record<string, string> = {
	"@sohedra/lynx": "background/root-entry.ts",
	"@sohedra/lynx/env": "env/index.ts",
	"@sohedra/lynx/gesture": "gesture/index.ts",
	"@sohedra/lynx/experimental": "gesture/experimental.ts",
	"@sohedra/lynx/host": "background/host-entry.ts",
	"@sohedra/lynx/config/svelte": "build/svelte-config/index.ts",
	"@sohedra/lynx/config/rsbuild": "build/plugin/index.ts",
	"@sohedra/lynx/testing": "testing/library-entry.ts",
};

/** Other packages' modules a fix line may name: each works on Lynx. */
const OTHER_MODULES: Record<string, () => Promise<Record<string, unknown>>> = {
	"esm-env": () => import("esm-env"),
	svelte: () => import("svelte"),
	"svelte/events": () => import("svelte/events"),
};

/** The names each of the package's entries exports, values and types, from its types. */
function ownExports(): Map<string, string[]> {
	const files = Object.values(OWN_ENTRIES).map((file) => path.join(SOURCE, file));
	const program = ts.createProgram(files, {
		allowImportingTsExtensions: true,
		noEmit: true,
		skipLibCheck: true,
		module: ts.ModuleKind.ESNext,
		moduleResolution: ts.ModuleResolutionKind.Bundler,
		target: ts.ScriptTarget.ESNext,
	});
	const checker = program.getTypeChecker();
	const found = new Map<string, string[]>();
	for (const [name, file] of Object.entries(OWN_ENTRIES)) {
		const source = program.getSourceFile(path.join(SOURCE, file))!;
		const symbol = checker.getSymbolAtLocation(source)!;
		found.set(
			name,
			checker.getExportsOfModule(symbol).map((each) => each.getName()),
		);
	}
	return found;
}

/** A name in a fix line, and where it works. */
type Resolves =
	/** An export of a module, which is checked. */
	| { from: string }
	/** Svelte's syntax, a rune, an element's attribute or method, or a setting, said as it is. */
	| { kind: string };

/**
 * Every API name the fix lines give the developer, and where it works. A fix line that names one
 * not here fails the walk: add it, with where it works on Lynx, in the same change.
 */
const NAMES: Record<string, Resolves> = {
	mountPage: { from: "@sohedra/lynx" },
	mount: { from: "@sohedra/lynx" },
	root: { from: "@sohedra/lynx" },
	mainThreadRef: { from: "@sohedra/lynx" },
	runOnMainThread: { from: "@sohedra/lynx" },
	runOnBackground: { from: "@sohedra/lynx" },
	createStaticCopy: { from: "@sohedra/lynx" },
	systemInfo: { from: "@sohedra/lynx/host" },
	background: { from: "@sohedra/lynx/env" },
	mainThread: { from: "@sohedra/lynx/env" },
	PanGesture: { from: "@sohedra/lynx/gesture" },
	RaceGesture: { from: "@sohedra/lynx/experimental" },
	defineConfig: { from: "@sohedra/lynx/config/svelte" },
	cleanup: { from: "@sohedra/lynx/testing" },
	unmount: { kind: "a method of what render resolves with" },
	"firstFrame: false": { kind: "an option of the plugin and of render's lynx" },
	"lynx: { firstFrame: true }": { kind: "an option of render" },
	"background: false": { kind: "an option of render's lynx" },
	BROWSER: { from: "esm-env" },
	onMount: { from: "svelte" },
	on: { from: "svelte/events" },
	import: { kind: "JavaScript's dynamic import()" },
	onUpdate: { kind: "a gesture's callback, as the developer passes it" },
	"item.id": { kind: "the developer's own value, as an example" },
	"sample.id": { kind: "the developer's own value, read from the message's details" },
	"ref.current": { kind: "a main-thread ref's value" },
	"package.json": { kind: "a file of the app" },
	devDependencies: { kind: "a field of the app's package.json" },
	"svelte.config.js": { kind: "a file of the app" },
	$effect: { kind: "a rune" },
	animate: { kind: "a method of the background's element nodes" },
	setStyleProperty: { kind: "a method of an element in a main-thread function" },
	"lynx.reload": { kind: "Lynx's own API on the background" },
	iOS: { kind: "a platform" },
	pluginLynx: { kind: "Lynx's Rsbuild plugin, @lynx-js/rsbuild-plugin" },
	// The settings of Rsbuild, Svelte and the plugin, named as written in a config file.
	"output.assetPrefix": { kind: "an Rsbuild setting" },
	"output.iife": { kind: "an Rsbuild setting" },
	"output.filename": { kind: "an Rsbuild setting" },
	"output.distPath": { kind: "an Rsbuild setting" },
	"tools.bundlerChain": { kind: "an Rsbuild setting" },
	"tools.swc": { kind: "an Rsbuild setting" },
	pageConfig: { kind: "an option of the plugin" },
	customRenderer: { kind: "a Svelte compile option" },
	compilerOptions: { kind: "a Svelte config option" },
	"define.mainThread": { kind: "an option of the plugin" },
	"define.background": { kind: "an option of the plugin" },
	"event.currentTarget.dataset": { kind: "an event's field" },
	"process.env.API": { kind: "the developer's own name, as an example" },
	__API__: { kind: "the developer's own name, as an example" },
	define: { kind: "an option of the plugin" },
	"dev: { hmr: false }": { kind: "an Rsbuild setting" },
	"tools.swc: false": { kind: "an Rsbuild setting" },
	"export default defineConfig({ … })": { kind: "the line of an app's svelte.config.js" },
	"export { a, b } from 'sample'": { kind: "JavaScript's syntax" },
	true: { kind: "a value" },
	false: { kind: "a value" },
	"<svelte:boundary>": { kind: "Svelte's syntax" },
	pending: { kind: "Svelte's syntax: a snippet of <svelte:boundary>" },
	"{#each}": { kind: "Svelte's syntax" },
	"{#if background}": { kind: "Svelte's syntax, with background from @sohedra/lynx/env" },
	"{#if mainThread}": { kind: "Svelte's syntax, with mainThread from @sohedra/lynx/env" },
	"{#if BROWSER}": { kind: "Svelte's syntax, with BROWSER from esm-env" },
	"{@attach}": { kind: "Svelte's syntax" },
	"{#if}": { kind: "Svelte's syntax" },
	"if (background)": { kind: "JavaScript's syntax, with background from @sohedra/lynx/env" },
	"main-thread:ref": { kind: "an attribute of Lynx's elements, which the binding reads" },
	"ontap={…}": { kind: "an event attribute of Lynx's elements" },
	"item-key": { kind: "an attribute of Lynx's <list-item>" },
	"data-*": { kind: "an attribute of Lynx's elements" },
	"<list-item>": { kind: "a Lynx element" },
	"<list-item defer>": { kind: "a Lynx element and its attribute" },
	"on(root, …)": { kind: "on() from svelte/events, with root from @sohedra/lynx" },
	'on(root, "sample", handler)': { kind: "on() from svelte/events, with root from @sohedra/lynx" },
	"runOnBackground(sample)": {
		kind: "runOnBackground from @sohedra/lynx, given the developer's function",
	},
	'with { runtime: "shared" }': { kind: "an import attribute, which the build reads" },
	'import { sample } from "@sohedra/lynx" with { runtime: "shared" }': {
		kind: "an import of @sohedra/lynx's export, with the attribute the build reads",
	},
};

/** The modules a fix line names, by their specifier. */
const MODULE = /@sohedra\/lynx(?:\/[\w-]+)*|\bsvelte\/[\w/-]+|\besm-env\b|@lynx-js\/[\w-]+/g;

/**
 * The API names in a fix line: a call (`name(`), a rune, a constructor after `new`, a camelCase or
 * dotted name, and a name imported `from` a module.
 */
const API_NAME =
	/\$[a-z]+\b|\bnew ([A-Z]\w*)|\b([a-z]+(?:\.[a-zA-Z]+)+)\b|\b([a-z]+[A-Z]\w*)\b|\b([A-Za-z_]\w*)\(|\b([A-Z]{2,}\w*) from\b/g;

/** Text a fix line takes from its details, which names nothing of an API. */
const SAMPLE = "sample";

/**
 * The API names and modules in one fix line: every text in backticks, whole (a trailing `()` left
 * out), then the names in what is left.
 */
function namesIn(fix: string): { names: string[]; modules: string[] } {
	const names: string[] = [];
	const modules: string[] = [];
	let rest = fix;
	for (const [quoted, inside] of fix.matchAll(/`([^`]+)`/g)) {
		rest = rest.replace(quoted, " ");
		const text = inside!.replace(/\(\)$/, "");
		if (text === SAMPLE) continue;
		if (new RegExp(`^(?:${MODULE.source})$`).test(text)) modules.push(text);
		else names.push(text);
	}
	modules.push(...[...rest.matchAll(MODULE)].map((match) => match[0]));
	for (const module of modules) rest = rest.replace(module, " ");
	for (const match of rest.matchAll(API_NAME)) {
		const name = match.slice(1).find((group) => group !== undefined) ?? match[0];
		if (name !== SAMPLE) names.push(name);
	}
	return { names, modules };
}

describe("every name a fix line gives", () => {
	const named = ENTRIES.map(({ program, code, entry }) => ({
		where: `${program}:${code}`,
		...namesIn(entry.fix(ANY_DETAILS)),
	}));

	it("is read whole from backticks, one-word and PascalCase names too", () => {
		const { names, modules } = namesIn(
			"Drive it with `Spring` or `Tween` from `svelte/motion`, or with `root` and `lynx.reload()`.",
		);
		expect(names).toEqual(["Spring", "Tween", "root", "lynx.reload"]);
		expect(modules).toEqual(["svelte/motion"]);
		expect(names.filter((name) => !(name in NAMES))).toEqual(["Spring", "Tween"]);
		expect(modules.filter((module) => !(module in OTHER_MODULES))).toEqual(["svelte/motion"]);
	});

	it("is one the walk knows", () => {
		const unknown = named.flatMap(({ where, names }) =>
			names.filter((name) => !(name in NAMES)).map((name) => `${where}: ${name}`),
		);
		expect(unknown).toEqual([]);
	});

	it("names a module that exists and works on Lynx", () => {
		const exports = Object.keys(packageJson.exports).map((key) =>
			key === "." ? "@sohedra/lynx" : `@sohedra/lynx/${key.slice(2)}`,
		);
		const wrong = named.flatMap(({ where, modules }) =>
			modules
				.filter((module) =>
					module.startsWith("@sohedra/lynx")
						? !exports.includes(module) || !(module in OWN_ENTRIES)
						: !module.startsWith("@lynx-js/") && !(module in OTHER_MODULES),
				)
				.map((module) => `${where}: ${module}`),
		);
		expect(wrong).toEqual([]);
	});

	it("is exported where the walk says", async () => {
		const own = ownExports();
		const missing: string[] = [];
		for (const [name, resolves] of Object.entries(NAMES)) {
			if (!("from" in resolves)) continue;
			const exported =
				own.get(resolves.from) ?? Object.keys((await OTHER_MODULES[resolves.from]?.()) ?? {});
			if (!exported.includes(name)) missing.push(`${name} from ${resolves.from}`);
		}
		expect(missing).toEqual([]);
	});
});

describe("the binding's messages", () => {
	/** The source files of a folder, deep. */
	function sources(folder: string): string[] {
		return fs
			.readdirSync(folder, { withFileTypes: true, recursive: true })
			.filter((entry) => entry.isFile() && entry.name.endsWith(".ts"))
			.map((entry) => path.join(entry.parentPath, entry.name));
	}

	/**
	 * Errors made from text written in place, which are no message of the binding's: the language's
	 * own messages of the `replaceAll` both threads fill in.
	 */
	const LANGUAGE_MESSAGES = [
		"String.prototype.replaceAll called on null or undefined",
		"replaceAll must be called with a global RegExp",
	];

	it("are written in a catalogue: no error is made from a literal text", () => {
		const written: string[] = [];
		for (const file of sources(SOURCE)) {
			const relative = path.relative(SOURCE, file);
			// The test library's own messages are for the test's author, not an app's.
			if (relative.startsWith("testing")) continue;
			const text = fs.readFileSync(file, "utf8");
			for (const match of text.matchAll(/new (?:Type|Range|Syntax)?Error\(\s*(["'`])([^"'`$]*)/g)) {
				if (LANGUAGE_MESSAGES.some((message) => match[2]!.startsWith(message))) continue;
				written.push(`${relative}: ${match[0]}`);
			}
		}
		expect(written).toEqual([]);
	});
});
