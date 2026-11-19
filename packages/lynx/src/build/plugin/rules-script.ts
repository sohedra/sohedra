// Rsbuild's JavaScript rule, split by thread: each thread compiles the page's scripts as it runs
// them.

import type { ChainIdentifier, RspackChain } from "@rsbuild/core";

import { PACKAGE_NAME } from "../../wire/index.ts";
import type { Thread } from "../../wire/index.ts";
import { buildError } from "../diagnostics/messages.ts";
import { LAYERS, THREADS, loaderPath } from "./layers.ts";

/** SWC loader options, as Rsbuild's JS rule has them. */
// oxlint-disable-next-line typescript/no-explicit-any -- SWC options are Rsbuild's untyped loader options, read and spread by shape
export type SwcOptions = Record<string, any>;
export type SwcByThread = Record<Thread, SwcOptions>;

// oxlint-disable-next-line typescript/no-explicit-any -- webpack-chain's Rule generic parent is invariant; any matches whatever parent Rsbuild passes
export type Rule = RspackChain.Rule<any>;

// Same lists as ReactLynx's main-thread SWC env.
//
// An exception to the app's `tools.swc` winning: PrimJS (ES2019) cannot run what these lists
// lower, so they go over the app's own `env` on the main thread.
const MAIN_THREAD_ENV = {
	targets: { chrome: "120" },
	include: [
		"transform-block-scoping",
		"transform-nullish-coalescing-operator",
		"transform-optional-chaining",
		"transform-export-namespace-from",
		"transform-logical-assignment-operators",
		"transform-numeric-separator",
		"transform-class-properties",
		"transform-class-static-block",
		"transform-private-methods",
		"transform-private-property-in-object",
	],
};

/** `.svelte.` anywhere in the name, as vite-plugin-svelte has it: Svelte's docs name rune test files `*.svelte.test.js`. */
export const SVELTE_MODULE: RegExp = /\.svelte\.(?:[^\\/]+\.)?[cm]?[jt]s$/;

/** What the rules of one thread are made of. */
export interface ThreadRules {
	thread: Thread;
	/** Free identifiers SWC replaces with these values. */
	defines: Record<string, string>;
	/** Hot reload: components swap in place, modules with main-thread functions decline. */
	hot: boolean;
	/** The rules take every module, not only those the thread's layer issues (a test run has no layers). */
	unlayered?: boolean;
}

/** The thread's branch of `rule`: the modules its layer issues. */
export function threadRule(rule: Rule, { thread, unlayered }: ThreadRules): Rule {
	const branch = rule.oneOf(thread);
	return unlayered === true ? branch : branch.issuerLayer(LAYERS[thread]);
}

/** Rsbuild's SWC loader options, from its JS rule. */
function rsbuildSwc(jsMain: Rule, CHAIN_ID: ChainIdentifier): SwcOptions {
	const swcUse = jsMain.uses.get(CHAIN_ID.USE.SWC);
	if (!swcUse) throw buildError({ code: "rsbuild_swc_missing", details: {} });
	// Boundary: Rsbuild's loader options are untyped.
	return (swcUse.get("options") ?? {}) as SwcOptions;
}

/**
 * SWC options that replace these free identifiers with their values. An exception to the app's
 * `tools.swc` winning: each thread's constants are the plugin's, over an app's variable of the
 * same name (its other variables stay). The bundler inlines them across modules and drops the
 * branches they decide.
 */
function withGlobals(options: SwcOptions, vars: Record<string, string>): SwcOptions {
	const jsc = options.jsc ?? {};
	const transform = jsc.transform ?? {};
	const optimizer = transform.optimizer ?? {};
	return {
		...options,
		jsc: {
			...jsc,
			transform: {
				...transform,
				optimizer: {
					...optimizer,
					globals: { ...optimizer.globals, vars: { ...optimizer.globals?.vars, ...vars } },
				},
			},
		},
	};
}

/** Main-thread functions of a plain script run first, on the source as written. */
export function useMainThreadFunctions(
	rule: Rule,
	options: { thread: Thread; hot: boolean },
): void {
	const { thread, hot } = options;
	rule
		.use(`${PACKAGE_NAME}:main-thread-functions`)
		.loader(loaderPath("main-thread-functions"))
		.options({ thread, hot });
}

/**
 * Split Rsbuild's JS rule by layer, and return each thread's SWC options for the Svelte rules to
 * reuse.
 */
export function splitScriptRule(options: {
	chain: RspackChain;
	CHAIN_ID: ChainIdentifier;
	threads: ThreadRules[];
}): SwcByThread {
	const { chain, CHAIN_ID, threads } = options;
	const jsRule = chain.module.rule(CHAIN_ID.RULE.JS);
	// `.svelte.ts` modules have their own rule: Svelte must compile them.
	jsRule.exclude.add(SVELTE_MODULE);

	const jsMain = jsRule.oneOf(CHAIN_ID.ONE_OF.JS_MAIN);
	const type = jsMain.get("type");
	const uses = jsMain.uses.entries() ?? {};
	const base = rsbuildSwc(jsMain, CHAIN_ID);

	const swc = Object.fromEntries(
		threads.map(({ thread, defines }) => {
			const own =
				thread === "main-thread" ? { ...base, env: { ...base.env, ...MAIN_THREAD_ENV } } : base;
			return [thread, withGlobals(own, defines)];
		}),
		// Boundary: `Object.fromEntries` types its keys as `string`; the threads are the keys.
	) as SwcByThread;

	// A test run's thread takes every module: Rsbuild's rule keeps its uses, because plugins after
	// this one read and change them there (Rstest's coverage adds its instrumentation to them). A
	// layered thread beside it gets a rule of its own, tried first.
	const unlayered = threads.find((rules) => rules.unlayered === true);
	if (unlayered) {
		jsMain.use(CHAIN_ID.USE.SWC).options(swc[unlayered.thread]);
		useMainThreadFunctions(jsMain, unlayered);
		for (const rules of threads) {
			if (rules === unlayered) continue;
			const rule = jsRule
				.oneOf(`${PACKAGE_NAME}:${rules.thread}`)
				.before(CHAIN_ID.ONE_OF.JS_MAIN)
				.issuerLayer(LAYERS[rules.thread]);
			if (type !== undefined) rule.type(type);
			for (const [name, use] of Object.entries(uses)) {
				rule
					.use(name)
					.loader(use.get("loader"))
					.options(name === CHAIN_ID.USE.SWC ? swc[rules.thread] : use.get("options"));
			}
			useMainThreadFunctions(rule, rules);
		}
		return swc;
	}

	jsMain.uses.clear();
	for (const rules of threads) {
		const rule = threadRule(jsMain, rules);
		if (type !== undefined) rule.type(type);
		// A copy of each use: `uses.merge` would share Rsbuild's use objects between the layers, and
		// the last layer's SWC options would win.
		for (const [name, use] of Object.entries(uses)) {
			rule
				.use(name)
				.loader(use.get("loader"))
				.options(name === CHAIN_ID.USE.SWC ? swc[rules.thread] : use.get("options"));
		}
		useMainThreadFunctions(rule, rules);
	}
	return swc;
}

/** The threads' rules for a build. */
export function threadsOf(options: {
	define: Record<Thread, Record<string, string>>;
	plugin: (thread: Thread) => Record<string, string>;
	hot: boolean;
}): ThreadRules[] {
	const { define, plugin, hot } = options;
	return THREADS.map((thread) => ({
		thread,
		// The plugin's own constants win over the app's.
		defines: { ...define[thread], ...plugin(thread) },
		hot: hot && thread === "background",
	}));
}
