// The Rstest presets: a config that compiles `.svelte` and scripts as a build does.

import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "@rstest/core";

import { withSvelteLynx, withSvelteLynxFromConfig } from "../../../../src/build/presets/rstest.ts";
import { PACKAGE_NAME } from "../../../../src/wire/index.ts";

const configs = path.resolve(import.meta.dirname, "../../../fixtures/build/configs");

/** The config an `extends` function gives. */
async function configOf(extend: ReturnType<typeof withSvelteLynx>) {
	// Boundary: Rstest passes the user's config; the presets read none of it.
	return (await extend({} as never)) as { plugins: { name?: string }[] } & Record<string, unknown>;
}
const names = (config: { plugins: { name?: string }[] }) =>
	config.plugins.map((plugin) => plugin.name);

describe("withSvelteLynx", () => {
	it("has the plugin, with the options it is given, and a plugin for the resolve conditions", async () => {
		const config = await configOf(withSvelteLynx({ dedupe: ["a-lib"] }));
		expect(names(config)).toEqual([PACKAGE_NAME, `${PACKAGE_NAME}:test-conditions`]);
	});

	it("checks the options when it is made, as the plugin does", () => {
		expect(() => withSvelteLynx({ firstframe: true } as never)).toThrow(
			"`firstframe` is not an option of `pluginSvelteLynx()`.",
		);
	});

	it("runs a test on a DOM, with a setup file that exists", async () => {
		const config = await configOf(withSvelteLynx());
		expect(config["testEnvironment"]).toBe("jsdom");
		const setup = config["setupFiles"] as string[];
		expect(setup).toHaveLength(1);
		expect(path.basename(setup[0]!)).toMatch(/^setup-rstest\.(ts|js)$/);
		expect(fs.existsSync(setup[0]!)).toBe(true);
	});

	it("bundles dependencies, so they resolve as on the background thread and not as in Node", async () => {
		expect(
			((await configOf(withSvelteLynx()))["output"] as { bundleDependencies: boolean })
				.bundleDependencies,
		).toBe(true);
	});
});

// Loading a config goes through a TypeScript config loader, cold on the first call.
describe("withSvelteLynxFromConfig", { timeout: 20_000 }, () => {
	it("reads lynx.config.* when an app has both, and adds the resolve conditions", async () => {
		const config = await configOf(
			withSvelteLynxFromConfig({ rootPath: path.join(configs, "both-configs") }),
		);
		expect(names(config)).toContain("from-lynx-config");
		expect(names(config)).not.toContain("from-rsbuild-config");
		expect(names(config)).toContain(`${PACKAGE_NAME}:test-conditions`);
	});

	it("reads the file it is told to", async () => {
		const config = await configOf(
			withSvelteLynxFromConfig({
				rootPath: path.join(configs, "both-configs"),
				configPath: path.join(configs, "both-configs", "rsbuild.config.ts"),
			}),
		);
		expect(names(config)).toContain("from-rsbuild-config");
	});

	it("runs the app's tests on the same DOM and setup file as a library's", async () => {
		const library = await configOf(withSvelteLynx());
		const app = await configOf(
			withSvelteLynxFromConfig({ rootPath: path.join(configs, "rsbuild-only") }),
		);
		expect(app["testEnvironment"]).toBe("jsdom");
		expect(app["setupFiles"]).toEqual(library["setupFiles"]);
	});

	it("takes the build's engine plugins that a test run has no use for out", async () => {
		const config = await configOf(
			withSvelteLynxFromConfig({ rootPath: path.join(configs, "rsbuild-only") }),
		);
		const removed = config.plugins.flatMap((plugin) =>
			"remove" in plugin ? (plugin as { remove: string[] }).remove : [],
		);
		expect(removed).toEqual(expect.arrayContaining(["lynx:rsbuild:qrcode", "lynx:rsbuild:target"]));
	});
});
