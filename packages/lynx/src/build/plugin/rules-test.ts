// The rules of a test run: one process plays both threads, so everything compiles as for the
// background thread, where Svelte runs, with no Lynx engine. A module of the main thread's layer
// compiles as the main thread's; nothing of a public test run enters that layer (the binding's own
// tests do, through ./first-frame-copies.ts).

import type { ChainIdentifier, RspackChain } from "@rsbuild/core";

import type { Thread } from "../../wire/index.ts";
import { RUNTIME_FILES } from "./layers.ts";
import { splitScriptRule } from "./rules-script.ts";
import { patchSvelteSource, splitSvelteRules } from "./rules-svelte.ts";
import type { SvelteRuleOptions } from "./rules-svelte.ts";
import { threadDefines } from "./thread-defines.ts";

/** What a test run says to its rules. */
export interface TestRuleOptions extends SvelteRuleOptions {
	chain: RspackChain;
	CHAIN_ID: ChainIdentifier;
	/** The app's `define` constants for the background thread, as code. */
	define: Record<string, string>;
	development: boolean;
}

/** The thread of a test run's modules, and the one of a module of the main thread's layer. */
const BACKGROUND: Thread = "background";
const MAIN_THREAD: Thread = "main-thread";

/** Set up the rules of a test run. */
export function configureTestRules(options: TestRuleOptions): void {
	const { chain, CHAIN_ID, define, development } = options;
	// Only the thread's constants are defined: the runtime's own flags stay unset, so a test can set
	// them.
	const threads = [
		{
			thread: MAIN_THREAD,
			defines: { ...threadDefines(MAIN_THREAD, development) },
			hot: false,
		},
		{
			thread: BACKGROUND,
			defines: { ...define, ...threadDefines(BACKGROUND, development) },
			hot: false,
			unlayered: true,
		},
	];
	const swc = splitScriptRule({ chain, CHAIN_ID, threads });
	// CSS stays with Rstest's own rules: there are no layers to split them by, and a test has no
	// template to put styles in.
	splitSvelteRules({ ...options, swc, threads });
	patchSvelteSource(chain);
	// The marker stays an empty module: a test imports what the app guards with it.
	chain.resolve.alias.set("background-only$", RUNTIME_FILES.backgroundOnly);
}

/**
 * How packages resolve in a test run: as on the background thread, where Svelte runs (its client
 * runtime, under `browser`), not as in Node.
 */
export function configureTestResolve(chain: RspackChain, development: boolean): void {
	chain.resolve.conditionNames
		.clear()
		.merge([
			"svelte",
			"lynx",
			"browser",
			"import",
			"require",
			development ? "development" : "production",
		]);
	// Spelled out: Rstest sets none, and a list with only `svelte` would leave packages without
	// `exports` unresolved.
	chain.resolve.mainFields.clear().merge(["svelte", "browser", "module", "main"]);
}
