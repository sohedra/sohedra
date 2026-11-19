// The Vitest preset: the options it takes from an app's config, the settings it gives Vitest, and
// the key of Vitest's module cache, which follows the binding's code and the plugin's options.

import path from "node:path";

import { describe, expect, it } from "@rstest/core";
import type { Plugin } from "vite";

import {
	cacheKey,
	svelteLynx,
	svelteLynxFromConfig,
} from "../../../../src/build/presets/vitest.ts";

const configs = path.resolve(import.meta.dirname, "../../../fixtures/build/configs");

/** What a plugin's `config` hook gives, by name. */
function configOf(plugins: Plugin[]): Record<string, unknown> {
	const hook = plugins.find((plugin) => plugin.config)?.config;
	// Boundary: the preset's hook is a plain function of nothing it reads.
	return (hook as () => Record<string, unknown>)();
}

describe("the Vitest preset", () => {
	it("refuses an unknown option, as the plugin does", () => {
		// @ts-expect-error not an option of the plugin.
		expect(() => svelteLynx({ firstFrames: false })).toThrow("firstFrames");
	});

	it("runs in jsdom with its setup file, and resolves as the background does", () => {
		const config = configOf(svelteLynx()) as {
			resolve: { conditions: string[] };
			test: { environment: string; setupFiles: string[]; server: { deps: { inline: RegExp[] } } };
		};
		expect(config.test.environment).toBe("jsdom");
		expect(config.test.setupFiles[0]).toMatch(/testing[\\/]setup-vitest\.[jt]s$/);
		expect(config.resolve.conditions.slice(0, 3)).toEqual(["svelte", "lynx", "browser"]);
		const inline = config.test.server.deps.inline;
		// Svelte, esm-env, the binding and the main thread's copies go through Vite; the rest is Node's.
		expect(inline.some((pattern) => pattern.test("/x/node_modules/svelte/src/index.js"))).toBe(
			true,
		);
		expect(inline.some((pattern) => pattern.test("/x/Card.svelte?lynx-main-thread"))).toBe(true);
		expect(inline.some((pattern) => pattern.test("/x/node_modules/lodash/index.js"))).toBe(false);
	});

	it("takes only the plugin's options from an app's config, not its aliases or constants", async () => {
		const plugins = await svelteLynxFromConfig({ rootPath: path.join(configs, "with-plugin") });
		const config = configOf(plugins) as {
			test: { server: { deps: { inline: RegExp[] } } };
			resolve: Record<string, unknown>;
		};
		expect(config.test.server.deps.inline.some((pattern) => pattern.test("/n/@app/ui/a.js"))).toBe(
			true,
		);
		expect(config.resolve["alias"]).toBeUndefined();
		expect(JSON.stringify(config)).not.toContain("__APP__");
	});

	it("keys Vitest's module cache on the binding's code and the plugin's options", () => {
		const keys: string[] = [];
		const plugin = svelteLynx().find((each) => "configureVitest" in each) as unknown as {
			configureVitest(context: { defineCacheKeyGenerator(generator: () => string): void }): void;
		};
		plugin.configureVitest({ defineCacheKeyGenerator: (generator) => keys.push(generator()) });
		expect(keys).toEqual([cacheKey({})]);
		expect(cacheKey({})).toMatch(/^@sohedra\/lynx:[0-9a-f]{16}$/);
		expect(cacheKey({ firstFrame: false })).not.toBe(cacheKey({}));
		expect(cacheKey({ svelte: { configFile: "a.config.js" } })).not.toBe(
			cacheKey({ svelte: { configFile: "b.config.js" } }),
		);
	});
});
