// Svelte components and rune modules, and the patches to Svelte's own text.

import type { RspackChain } from "@rsbuild/core";

import {
	isPrimjsRegexFile,
	PRIMJS_REGEX_REWRITES,
	SPREAD_SETTER_FILE,
} from "../../svelte/build/index.ts";
import type { CompileOptions, PreprocessorGroup } from "../../svelte/build/index.ts";
import { PACKAGE_NAME, RENDERER_ENTRY } from "../../wire/index.ts";
import type { Thread } from "../../wire/index.ts";
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
 * It is read as TypeScript, which is said here because the build relies on it: on the main thread
 * a component's module ends with its main-thread functions as they were written, types included.
 */
function afterSvelte(options: SwcOptions): SwcOptions {
	return {
		...options,
		detectSyntax: false,
		jsc: {
			...options.jsc,
			parser: { ...options.jsc?.parser, syntax: "typescript", tsx: false },
			transform: { ...options.jsc?.transform, verbatimModuleSyntax: true },
		},
	};
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
	// Loaders run bottom-up: Svelte compiles, then SWC lowers.
	component
		.use("swc")
		.loader("builtin:swc-loader")
		.options(swc)
		.end()
		.use("svelte")
		.loader(loaderPath("svelte-component"))
		.options(componentOptions);

	const moduleOptions: SvelteModuleLoaderOptions = {
		thread,
		compilerOptions: moduleCompilerOptions(compilerOptions),
	};
	runeModule
		.type("javascript/auto")
		.use("swc")
		.loader("builtin:swc-loader")
		.options(swc)
		.end()
		.use("svelte")
		.loader(loaderPath("svelte-module"))
		.options(moduleOptions)
		.end()
		.use("strip-ts")
		.loader("builtin:swc-loader")
		.options({
			jsc: {
				parser: { syntax: "typescript", tsx: false, decorators: true },
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
			afterSvelte(swc[rules.thread]),
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
