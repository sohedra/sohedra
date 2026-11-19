// Vitest presets that compile Svelte files the way a Lynx build does, for a test run, as the Rstest
// presets do:
//
//   svelteLynx(options)              a library: no app config, the plugin with these options
//   svelteLynxFromConfig(options)    an app: the options of the plugin in its lynx.config.* or
//                                    rsbuild.config.*
//
//   // vitest.config.ts
//   import { svelteLynx } from "@sohedra/lynx/config/vitest";
//   import { defineConfig } from "vitest/config";
//   export default defineConfig({ plugins: [svelteLynx()] });

import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import type { Plugin } from "vite";

import { PACKAGE_NAME } from "../../wire/index.ts";
import { workingDirectory } from "../globals.ts";
import { PLUGIN_OPTIONS } from "../plugin/index.ts";
import type { PluginSvelteLynxOptions } from "../plugin/index.ts";
import { PACKAGE_ROOT } from "../plugin/layers.ts";
import { checkPluginOptions } from "../plugin/option-checks.ts";
import { resolveOptions } from "../plugin/options.ts";
import { loadLynxConfig } from "./config-file.ts";
import type { ConfigFileOptions } from "./config-file.ts";
import { checkTestPeers } from "./test-peers.ts";
import { vitePlugins } from "./vite-plugin.ts";

/** What the Vitest preset's plugin hears of the run: the hook that keys Vitest's module cache. */
interface CacheKeyContext {
	defineCacheKeyGenerator?: (generator: () => string) => void;
	experimental_defineCacheKeyGenerator?: (generator: () => string) => void;
}

/** The hash of the binding's version and of the code that compiles: read once a process. */
let bindingHash: string | undefined;

function hashBinding(): string {
	const hash = createHash("sha256");
	const manifest = fs.readFileSync(path.join(PACKAGE_ROOT, "package.json"), "utf8");
	hash.update((JSON.parse(manifest) as { version: string }).version);
	// The code that compiles: the build's folder and Svelte's touchpoints of it, as installed.
	const programs = path.dirname(path.dirname(import.meta.dirname));
	for (const folder of ["build", "svelte/build"]) {
		const at = path.join(programs, folder);
		const files = fs
			.readdirSync(at, { recursive: true, encoding: "utf8" })
			.filter((file) => /\.[jt]s$/.test(file))
			.sort();
		for (const file of files) hash.update(file).update(fs.readFileSync(path.join(at, file)));
	}
	return hash.digest("hex");
}

/**
 * What keys a transformed module in Vitest's file-system cache, besides its source: the binding's
 * version, its build code, the plugin's options, and what the compile read (`compiling`: the app's
 * Svelte options and the installed Svelte). Vitest keys the cache on the source and Vite's config
 * only, so after an upgrade of the binding or of Svelte, or a change of `svelte.config.js`, a run
 * would test what was compiled before.
 */
export function cacheKey(given: unknown, compiling = ""): string {
	bindingHash ??= hashBinding();
	const hash = createHash("sha256").update(bindingHash).update(compiling);
	hash.update(
		JSON.stringify(given ?? {}, (_key, value: unknown) =>
			typeof value === "function" ? String(value) : value,
		),
	);
	return `${PACKAGE_NAME}:${hash.digest("hex").slice(0, 16)}`;
}

/** The plugins for the options given, the last one keying Vitest's cache on them. */
function plugins(options: PluginSvelteLynxOptions, rootPath?: string): Plugin[] {
	const run = vitePlugins(resolveOptions(options), { rootPath, given: options });
	// Made when Vitest first asks, once Vite's config, and with it the Svelte options, is resolved.
	let key: string | undefined;
	const keying: Plugin & { configureVitest(context: CacheKeyContext): void } = {
		name: `${PACKAGE_NAME}:vitest-cache`,
		configureVitest(context) {
			const define =
				context.defineCacheKeyGenerator ?? context.experimental_defineCacheKeyGenerator;
			define?.(() => (key ??= cacheKey(options, run.compileInputs())));
		},
	};
	return [...run.plugins, keying];
}

/**
 * A library's tests (no app config): what `pluginSvelteLynx` does in a test run, with `options` as
 * the app using the library would set them. Put the result in `plugins` of `vitest.config.ts`.
 * Throws when an option is unknown or has a wrong value, or when the app lacks what the tests run
 * with: `vitest`, `vite`, `jsdom` and `@testing-library/dom`.
 *
 * A Vitest run compiles each thread's copy as a Rstest run does, with these differences:
 *
 * | Part | Under Vitest |
 * | --- | --- |
 * | TypeScript | Stripped by Vite's compiler, not SWC; nothing is lowered, which Node does not need |
 * | `define` and the thread's constants | Replaced in each thread's copy of the app's code and the binding's, not in other packages |
 * | Dependencies | Svelte, `esm-env`, the binding, the `singleCopy` packages and every main-thread copy go through Vite; other packages are loaded by Node as they are, where Rstest bundles them |
 * | An app's config | `svelteLynxFromConfig` reads the plugin's options only: not the config's aliases or `source.define` |
 * | Vitest's module cache | Keyed on the binding's version and build code, the plugin's options, the Svelte config and the installed Svelte, so a change of any compiles again |
 *
 * The rest is the same: styles are left out and the scoping class kept, the build's messages, and
 * `firstFrame: false` leaving the first-frame copies out.
 */
export function svelteLynx(options: PluginSvelteLynxOptions = {}): Plugin[] {
	checkPluginOptions(options);
	checkTestPeers({ runner: "vitest", preset: "svelteLynx()", root: workingDirectory() });
	return plugins(options);
}

/**
 * An app's tests: the options of the `pluginSvelteLynx()` in its `lynx.config.*` (rspeedy) or
 * `rsbuild.config.*`. Only that plugin's options come along: the rest of the app's config (its
 * aliases, `source.define`) does not reach a Vitest run. Put the result in `plugins` of
 * `vitest.config.ts`.
 */
export async function svelteLynxFromConfig(options: ConfigFileOptions = {}): Promise<Plugin[]> {
	const rootPath = options.rootPath ?? workingDirectory();
	checkTestPeers({ runner: "vitest", preset: "svelteLynxFromConfig()", root: rootPath });
	const config = await loadLynxConfig(options);
	// An Rsbuild config may nest its plugins in lists.
	const flat = (list: readonly unknown[]): unknown[] =>
		list.flatMap((item) => (Array.isArray(item) ? flat(item) : [item]));
	const found = flat(config.plugins ?? []).find(
		(plugin) => typeof plugin === "object" && plugin !== null && PLUGIN_OPTIONS in plugin,
	);
	// Boundary: the plugin keeps its options under its own key.
	const given = (found as Record<symbol, PluginSvelteLynxOptions> | undefined)?.[PLUGIN_OPTIONS];
	return plugins(given ?? {}, rootPath);
}
