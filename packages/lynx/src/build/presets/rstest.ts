// Rstest presets that compile Svelte files the way a Lynx build does, for a test run:
//
//   withSvelteLynx(options)       a library: no app config, the plugin with these options
//   withSvelteLynxFromConfig()    an app: its lynx.config.* (rspeedy) or rsbuild.config.*
//
//   // rstest.config.ts
//   import { defineConfig } from "@rstest/core";
//   import { withSvelteLynx } from "@sohedra/lynx/config/rstest";
//   export default defineConfig({ extends: withSvelteLynx() });

import type { RsbuildPlugin } from "@rsbuild/core";
import type { ExtendConfig, ExtendConfigFn } from "@rstest/core";

import { pluginSvelteLynx } from "../plugin/index.ts";
import type { PluginSvelteLynxOptions } from "../plugin/index.ts";
import { checkPluginOptions } from "../plugin/option-checks.ts";
import { loadLynxConfig } from "./config-file.ts";
import type { ConfigFileOptions } from "./config-file.ts";

export type { ConfigFileOptions };

// Engine plugins with no part in a test run: the dev QR code, and the build target (tests run in
// Node, not on Lynx).
const ENGINE_PLUGINS_NOT_FOR_TESTS = ["lynx:rsbuild:qrcode", "lynx:rsbuild:target"];

interface ResolveOptions {
	conditionNames?: string[];
	byDependency?: Record<string, unknown>;
}

/**
 * Each kind of import gets the conditions it should have: an `import` (and `import()`) the ES
 * ones, a `require()` the CommonJS ones, as Node resolves them. The test resolve names both kinds
 * together, so a CommonJS helper of a dependency could resolve to its ES build.
 */
function byKindOfImport(resolve: ResolveOptions | undefined): void {
	const names = resolve?.conditionNames;
	if (!resolve || !names) return;
	resolve.byDependency = {
		...resolve.byDependency,
		esm: { conditionNames: names.filter((name) => name !== "require") },
		commonjs: { conditionNames: names.filter((name) => name !== "import") },
	};
}

/** Gives the test resolve its conditions by kind of import. */
const conditionsByImport: RsbuildPlugin = {
	name: "svelte-lynx:test-conditions",
	setup(api) {
		api.modifyRspackConfig((config) => byKindOfImport(config.resolve as ResolveOptions));
	},
};

/**
 * What a test run needs besides the compile: its test environment (the page's elements and a
 * setup file that cleans up after each test). The package's own is added here when it exists;
 * until then a run has none and nothing stands in for it.
 */
function testEnvironment(): ExtendConfig {
	return {};
}

/** What every test run shares. */
function defaults(): ExtendConfig {
	return {
		...testEnvironment(),
		output: {
			// Node would load packages with its own conditions (Svelte's server runtime); bundled, they
			// resolve as on the background thread.
			bundleDependencies: true,
		},
	};
}

/**
 * A library's tests (no app config): the plugin with `options`, as the app using the library would
 * set them. Throws when an option is unknown or has a wrong value.
 */
export function withSvelteLynx(options: PluginSvelteLynxOptions = {}): ExtendConfigFn {
	checkPluginOptions(options);
	return () => ({
		...defaults(),
		plugins: [pluginSvelteLynx(options), conditionsByImport],
	});
}

/**
 * An app's tests: its own build config (and with it, its `pluginSvelteLynx` options), through
 * `@rstest/adapter-rsbuild`.
 */
export function withSvelteLynxFromConfig(options: ConfigFileOptions = {}): ExtendConfigFn {
	return async () => {
		const { toRstestConfig } = await import("@rstest/adapter-rsbuild");
		const config = toRstestConfig({ rsbuildConfig: await loadLynxConfig(options) });
		const shared = defaults();
		return {
			...config,
			...shared,
			output: { ...config.output, ...shared.output },
			plugins: [
				...(config.plugins ?? []),
				conditionsByImport,
				{
					name: "svelte-lynx:test-run",
					remove: ENGINE_PLUGINS_NOT_FOR_TESTS,
					setup() {},
				} satisfies RsbuildPlugin,
			],
		};
	};
}
