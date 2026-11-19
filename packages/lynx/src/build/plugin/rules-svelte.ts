// Svelte components and rune modules, and the patches to Svelte's own text.

import fs from "node:fs";

import type { RspackChain } from "@rsbuild/core";

import {
	isPrimjsRegexFile,
	PRIMJS_REGEX_REWRITES,
	SPREAD_SETTER_FILE,
} from "../../svelte/build/index.ts";
import type { CompileOptions, PreprocessorGroup } from "../../svelte/build/index.ts";
import { PACKAGE_NAME, RENDERER_ENTRY } from "../../wire/index.ts";
import type { Thread } from "../../wire/index.ts";
import { writtenInTypeScript } from "../compile/component.ts";
import type { SvelteComponentLoaderOptions } from "../loaders/svelte-component.ts";
import type { SvelteModuleLoaderOptions } from "../loaders/svelte-module.ts";
import { RUNTIME_FILES, loaderPath } from "./layers.ts";
import { SVELTE_MODULE, threadRule, useMainThreadFunctions } from "./rules-script.ts";
import type { Rule, SwcByThread, SwcOptions, ThreadRules } from "./rules-script.ts";
import { moduleCompilerOptions } from "./svelte-options.ts";

const SVELTE_COMPONENT = /\.svelte$/;

/** What the Svelte rules take from the plugin's options. */
export interface SvelteRuleOptions {
	compilerOptions: CompileOptions;
	preprocess: PreprocessorGroup[];
	/** A test run's: each background component carries its first-frame copy. */
	firstFrameCopies?: boolean;
}

/**
 * What SWC is told about the Svelte compiler's output. An exception to the app's `tools.swc`
 * winning: the build relies on all of it.
 *
 * It keeps every import as written, as with Vite: each one loads on both threads even where
 * nothing uses it, as on Svelte's server (the main thread): a `<svelte:boundary>`'s children with
 * `pending`, imports only `$effect` uses. TypeScript would drop those, and with them the
 * main-thread functions they define.
 *
 * Svelte's output is JavaScript, read as such: TypeScript reads some of it otherwise
 * (`` a < b > `0` `` is a call there). Only a component written in TypeScript is read as
 * TypeScript: on the main thread its module ends with its main-thread functions as written, types
 * included.
 */
function afterSvelte(options: SwcOptions, typescript: boolean): SwcOptions {
	const { tsx: _tsx, dts: _dts, syntax: _syntax, ...parser } = options.jsc?.parser ?? {};
	return {
		...options,
		detectSyntax: false,
		jsc: {
			...options.jsc,
			parser: typescript
				? { ...parser, syntax: "typescript", tsx: false }
				: { ...parser, syntax: "ecmascript" },
			transform: { ...options.jsc?.transform, verbatimModuleSyntax: true },
		},
	};
}

/** Whether a component's file is written in TypeScript; kept while the file is unchanged. */
const languages = new Map<string, { mtimeMs: number; size: number; typescript: boolean }>();
function componentInTypeScript(file: string): boolean {
	let stats: fs.Stats;
	try {
		stats = fs.statSync(file);
	} catch {
		return false;
	}
	const known = languages.get(file);
	if (known?.mtimeMs === stats.mtimeMs && known.size === stats.size) return known.typescript;
	const typescript = writtenInTypeScript(fs.readFileSync(file, "utf8"));
	languages.set(file, { mtimeMs: stats.mtimeMs, size: stats.size, typescript });
	return typescript;
}

function useSvelteLoaders(
	component: Rule,
	runeModule: Rule,
	thread: Thread,
	swc: SwcOptions,
	options: SvelteRuleOptions & { hot: boolean },
): void {
	const { compilerOptions, preprocess, hot } = options;
	const componentOptions: SvelteComponentLoaderOptions = {
		thread,
		renderer: RENDERER_ENTRY,
		compilerOptions,
		preprocess,
		hot,
		...(options.firstFrameCopies && thread === "background" && { firstFrameCopy: true }),
		...(thread === "main-thread"
			? { serverInternals: RUNTIME_FILES.serverInternals }
			: { clientInternals: RUNTIME_FILES.clientInternals }),
	};
	// Loaders run bottom-up: Svelte compiles, then SWC lowers, reading the output in the language
	// the component is written in.
	for (const typescript of [true, false]) {
		const branch = component.oneOf(typescript ? "typescript" : "javascript");
		if (typescript) branch.test(componentInTypeScript);
		branch
			.use("swc")
			.loader("builtin:swc-loader")
			.options(afterSvelte(swc, typescript))
			.end()
			.use("svelte")
			.loader(loaderPath("svelte-component"))
			.options(componentOptions);
	}

	const moduleOptions: SvelteModuleLoaderOptions = {
		thread,
		compilerOptions: moduleCompilerOptions(compilerOptions),
	};
	// The rune module's types were stripped before Svelte compiled it: its output is JavaScript.
	runeModule
		.type("javascript/auto")
		.use("swc")
		.loader("builtin:swc-loader")
		.options(afterSvelte(swc, false))
		.end()
		.use("svelte")
		.loader(loaderPath("svelte-module"))
		.options(moduleOptions)
		.end()
		.use("strip-ts")
		.loader("builtin:swc-loader")
		.options({
			// By the file's extension: a `.svelte.js` module is JavaScript, which TypeScript reads
			// otherwise (`a < b > (c)` is a call there).
			detectSyntax: "auto",
			jsc: {
				parser: { decorators: true },
				target: "esnext",
				// Keep `x = $state(0)` as a class field for the Svelte compiler.
				transform: { useDefineForClassFields: true },
			},
		});
	useMainThreadFunctions(runeModule, { thread, hot });
}

/**
 * Svelte components and rune modules: the app on the background thread, and again on the main
 * thread for Svelte's server renderer (the first frame).
 */
export function splitSvelteRules(
	options: SvelteRuleOptions & {
		chain: RspackChain;
		swc: SwcByThread;
		threads: ThreadRules[];
	},
): void {
	const { chain, swc, threads } = options;
	const component = chain.module.rule(`${PACKAGE_NAME}:component`).test(SVELTE_COMPONENT);
	const runeModule = chain.module.rule(`${PACKAGE_NAME}:module`).test(SVELTE_MODULE);
	for (const rules of threads) {
		useSvelteLoaders(
			threadRule(component, rules),
			threadRule(runeModule, rules),
			rules.thread,
			swc[rules.thread],
			{ ...options, hot: rules.hot },
		);
	}
}

/** The two patches to Svelte's own text, which run before anything else reads it. */
export function patchSvelteSource(chain: RspackChain): void {
	for (const rewrite of PRIMJS_REGEX_REWRITES) {
		chain.module
			.rule(`${PACKAGE_NAME}:primjs-regex:${rewrite.name}`)
			.test((resource: string) => isPrimjsRegexFile(resource, rewrite.file))
			.enforce("pre")
			.use("primjs-regex")
			.loader(loaderPath("primjs-regex"));
	}
	chain.module
		.rule(`${PACKAGE_NAME}:svelte-spread-setter`)
		.test(SPREAD_SETTER_FILE)
		.enforce("pre")
		.use("svelte-spread-setter")
		.loader(loaderPath("svelte-spread-setter"));
}
