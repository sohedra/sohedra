// The rules of a build: each thread compiles the page's scripts, CSS and Svelte files as it runs
// them.

import type { ChainIdentifier, ModifyBundlerChainUtils, RspackChain } from "@rsbuild/core";

import type { Thread } from "../../wire/index.ts";
import { PACKAGE_NAME } from "../../wire/index.ts";
import { DEV_CLIENT_FILE } from "../loaders/dev-client.ts";
import type { DevClientLoaderOptions } from "../loaders/dev-client.ts";
import { DevClientCheckPlugin } from "./dev-client-check.ts";
import { EngineRegExpsPlugin } from "./engine-regexps.ts";
import { loaderPath, RUNTIME_FILES } from "./layers.ts";
import { configureCssRules, keepSelectorListsApart } from "./rules-css.ts";
import { splitScriptRule, threadsOf } from "./rules-script.ts";
import { patchSvelteSource, splitSvelteRules } from "./rules-svelte.ts";
import type { SvelteRuleOptions } from "./rules-svelte.ts";
import { pluginDefines } from "./thread-defines.ts";

/** What a build says about itself to its rules. */
export interface BuildRuleOptions extends SvelteRuleOptions {
	chain: RspackChain;
	CHAIN_ID: ChainIdentifier;
	/** The app's `define` constants for each thread, as code. */
	define: Record<Thread, Record<string, string>>;
	development: boolean;
	/** Hot reload follows Rsbuild's `dev.hmr`. */
	hot: boolean;
	/** Whether any entry draws its first frame. */
	firstFrame: boolean;
}

/** Set up the rules of a build. */
export function configureBuildRules(options: BuildRuleOptions): void {
	const { chain, CHAIN_ID, define, development, hot, firstFrame } = options;
	const threads = threadsOf({
		define,
		plugin: (thread) => pluginDefines(thread, { development, firstFrame }),
		hot,
	});
	const swc = splitScriptRule({ chain, CHAIN_ID, threads });
	configureCssRules(chain, CHAIN_ID);
	keepSelectorListsApart(chain, CHAIN_ID);
	splitSvelteRules({ ...options, swc, threads });
	patchSvelteSource(chain);
	chain.plugin(`${PACKAGE_NAME}:engine-regexps`).use(EngineRegExpsPlugin);
	if (development) patchDevClientSource(chain);
}

/** In a development build, the binding's calls in Lynx's dev client (loaders/dev-client.ts). */
function patchDevClientSource(chain: RspackChain): void {
	const options: DevClientLoaderOptions = { devClient: RUNTIME_FILES.devClient };
	chain.module
		.rule(`${PACKAGE_NAME}:dev-client`)
		.test(DEV_CLIENT_FILE)
		.enforce("pre")
		.use("dev-client")
		.loader(loaderPath("dev-client"))
		.options(options);
	chain.plugin(`${PACKAGE_NAME}:dev-client-check`).use(DevClientCheckPlugin);
}

/**
 * `process.env.DEBUG` in a build: the build's own `DEBUG` variable, or `null` when it is not set,
 * on both threads. ReactLynx's plugin does the same, for packages that read it (the `debug`
 * package, say).
 */
export function defineDebugEnvironment(
	chain: RspackChain,
	bundler: ModifyBundlerChainUtils["bundler"],
): void {
	chain.plugin(`${PACKAGE_NAME}:environment`).use(bundler.EnvironmentPlugin, [{ DEBUG: null }]);
}
