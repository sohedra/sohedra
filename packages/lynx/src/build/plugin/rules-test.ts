// The rules of a test run: one process plays both threads, so everything compiles as for the
// background thread, where Svelte runs, with no Lynx engine. A component imported with the query
// `?first-frame` is the page's main-thread copy instead: it and all it imports compile in the main
// thread's layer, as a build's first frame does.

import type { ChainIdentifier, RspackChain } from "@rsbuild/core";

import { PACKAGE_NAME } from "../../wire/index.ts";
import type { Thread } from "../../wire/index.ts";
import { LAYERS, RUNTIME_FILES, loaderPath } from "./layers.ts";
import { mainThreadConditions } from "./resolve.ts";
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

/** The thread of a test run's modules; the first frame's copies are the main thread's. */
const BACKGROUND: Thread = "background";
const MAIN_THREAD: Thread = "main-thread";

/** The query that imports a component's first-frame copy. */
const FIRST_FRAME_QUERY = /[?&]first-frame(?:&|$)/;

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
	// The copy's own module starts the main thread's layer; its rule is the component rule's first.
	chain.module
		.rule(`${PACKAGE_NAME}:component`)
		.oneOf(`${PACKAGE_NAME}:first-frame-copy`)
		.resourceQuery(FIRST_FRAME_QUERY)
		.layer(LAYERS[MAIN_THREAD])
		.use("first-frame-copy")
		.loader(loaderPath("first-frame-copy"))
		.options({ startPage: RUNTIME_FILES.firstFramePage });
	splitSvelteRules({ ...options, swc, threads });
	patchSvelteSource(chain);
	// Packages resolve on the main thread as in a build: to their server builds.
	chain.module
		.rule(`${PACKAGE_NAME}:main-thread-resolve`)
		.issuerLayer(LAYERS[MAIN_THREAD])
		.resolve.conditionNames.merge(mainThreadConditions(development));
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
