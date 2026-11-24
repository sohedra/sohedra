// The Svelte options of the app being built, read from its svelte.config.js.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { afterAll, describe, expect, it } from "@rstest/core";

import {
	findSvelteConfig,
	moduleCompilerOptions,
	pickCompilerOptions,
	readSvelteOptions,
} from "../../../../src/build/plugin/svelte-options.ts";
import { defineConfig } from "../../../../src/build/svelte-config/index.ts";

const made: string[] = [];
afterAll(() => {
	for (const folder of made) fs.rmSync(folder, { recursive: true, force: true });
});

/** An app folder with these files. */
function appWith(files: Record<string, string>): string {
	const folder = fs.mkdtempSync(path.join(os.tmpdir(), "sohedra-lynx-app-"));
	made.push(folder);
	for (const [name, text] of Object.entries(files)) fs.writeFileSync(path.join(folder, name), text);
	return folder;
}

// A URL: Node imports a path that starts with a drive letter as a URL of that scheme.
const helper = pathToFileURL(
	path.resolve(import.meta.dirname, "../../../../src/build/svelte-config/index.ts"),
).href;

describe("findSvelteConfig", () => {
	it("finds svelte.config.js, .mjs, .ts and .mts in that order", () => {
		expect(findSvelteConfig(appWith({ "svelte.config.mjs": "", "svelte.config.ts": "" }))).toMatch(
			/svelte\.config\.mjs$/,
		);
		expect(findSvelteConfig(appWith({ "svelte.config.mts": "" }))).toMatch(/svelte\.config\.mts$/);
	});

	it("takes the file the app names, from its folder", () => {
		expect(findSvelteConfig("/app", "config/svelte.js")).toBe(
			path.resolve("/app/config/svelte.js"),
		);
	});

	it("is none for an app without one", () => {
		expect(findSvelteConfig(appWith({}))).toBeUndefined();
	});
});

describe("pickCompilerOptions", () => {
	it("keeps what an app may set, and the async flag, and warns about nothing", () => {
		const { compilerOptions, warnings } = pickCompilerOptions({
			rootDir: "/app",
			preserveComments: true,
			cssHash: () => "h",
			experimental: { async: true },
		});
		expect(compilerOptions).toMatchObject({
			rootDir: "/app",
			preserveComments: true,
			experimental: { async: true },
		});
		expect(warnings).toEqual([]);
	});

	it("takes async mode turned off, without a word", () => {
		const { compilerOptions, warnings } = pickCompilerOptions({ experimental: { async: false } });
		expect(compilerOptions.experimental?.async).toBe(false);
		expect(warnings).toEqual([]);
	});

	it("drops what the build decides and warns, naming the option", () => {
		const { compilerOptions, warnings } = pickCompilerOptions({
			generate: "server",
			css: "injected",
			dev: true,
		});
		expect(compilerOptions).not.toHaveProperty("generate");
		expect(compilerOptions).not.toHaveProperty("css");
		expect(warnings.map((warning) => warning.code)).toEqual([
			"svelte_config_option_owned",
			"svelte_config_option_owned",
			"svelte_config_option_owned",
		]);
		expect(warnings[0]?.message).toContain(
			"`compilerOptions.generate` in svelte.config.js is set by @sohedra/lynx",
		);
	});

	it("drops what is not supported on Lynx and warns, naming it", () => {
		const { warnings } = pickCompilerOptions({ accessors: true, experimental: { other: true } });
		expect(warnings.map((warning) => warning.message.split("\n")[0])).toEqual([
			"`compilerOptions.accessors` in svelte.config.js is not supported on Lynx, so it is ignored.",
			"`compilerOptions.experimental.other` in svelte.config.js is not supported on Lynx, so it is ignored.",
		]);
	});

	it("does not warn about what `defineConfig()` sets itself", () => {
		const { compilerOptions } = defineConfig();
		expect(pickCompilerOptions({ ...compilerOptions }).warnings).toEqual([]);
	});

	it("always runs the app's warning filter behind the one that drops `attribute_illegal_colon`", () => {
		const { compilerOptions } = pickCompilerOptions({
			warningFilter: (warning: { code: string }) => warning.code !== "mine",
		});
		const filter = compilerOptions.warningFilter!;
		const warning = (code: string) => ({ code }) as never;
		expect(filter(warning("attribute_illegal_colon"))).toBe(false);
		expect(filter(warning("mine"))).toBe(false);
		expect(filter(warning("other"))).toBe(true);
		expect(
			pickCompilerOptions({}).compilerOptions.warningFilter!(warning("attribute_illegal_colon")),
		).toBe(false);
	});
});

describe("moduleCompilerOptions", () => {
	it("takes the options that `compileModule` takes too", () => {
		const options = moduleCompilerOptions({
			rootDir: "/app",
			warningFilter: () => true,
			preserveComments: true,
		});
		expect(Object.keys(options).toSorted((a, b) => a.localeCompare(b))).toEqual([
			"rootDir",
			"warningFilter",
		]);
	});
});

describe("readSvelteOptions", () => {
	it("is the defaults for an app without a config", async () => {
		const options = await readSvelteOptions(appWith({}));
		expect(options.preprocess).toEqual([]);
		expect(options.warnings).toEqual([]);
		expect(options.compilerOptions.warningFilter).toBeTypeOf("function");
	});

	it("reads the config's compiler options and preprocessors", async () => {
		const root = appWith({
			"svelte.config.js": `import { defineConfig } from ${JSON.stringify(helper)};
export default defineConfig({ compilerOptions: { rootDir: "/app", experimental: { async: true } }, preprocess: [{ name: "mine" }] });`,
		});
		const options = await readSvelteOptions(root);
		expect(options.compilerOptions.rootDir).toBe("/app");
		expect(options.compilerOptions.experimental).toEqual({ async: true });
		expect(options.preprocess).toEqual([{ name: "mine" }]);
		expect(options.warnings).toEqual([]);
	});

	it("reads a plain object as the same config wrapped in `defineConfig()`", async () => {
		const config = `{ compilerOptions: { rootDir: "/x", experimental: { async: true } }, preprocess: [{ name: "mine" }] }`;
		const plain = await readSvelteOptions(
			appWith({ "svelte.config.js": `export default ${config};` }),
		);
		const wrapped = await readSvelteOptions(
			appWith({
				"svelte.config.js": `import { defineConfig } from ${JSON.stringify(helper)};
export default defineConfig(${config});`,
			}),
		);
		const { warningFilter: plainFilter, ...plainOptions } = plain.compilerOptions;
		const { warningFilter: wrappedFilter, ...wrappedOptions } = wrapped.compilerOptions;
		expect(plainOptions).toEqual(wrappedOptions);
		expect(plain.preprocess).toEqual(wrapped.preprocess);
		expect([plain.warnings, wrapped.warnings]).toEqual([[], []]);
		const colon = { code: "attribute_illegal_colon" } as never;
		expect([plainFilter!(colon), wrappedFilter!(colon)]).toEqual([false, false]);
	});

	it("reads a config that is a plain object, and warns about what it ignores", async () => {
		const options = await readSvelteOptions(
			appWith({ "svelte.config.js": "export default { compilerOptions: { accessors: true } };" }),
		);
		expect(options.warnings).toHaveLength(1);
	});

	it("reads the file the app names", async () => {
		const root = appWith({ "other.js": "export default { compilerOptions: { rootDir: '/x' } };" });
		expect((await readSvelteOptions(root, "other.js")).compilerOptions.rootDir).toBe("/x");
	});

	it("fails with the build's message for a file that throws or has no default export", async () => {
		await expect(
			readSvelteOptions(appWith({ "svelte.config.js": "throw new Error('boom');" })),
		).rejects.toMatchObject({
			code: "svelte_config_invalid",
			message: expect.stringContaining("boom"),
		});
		await expect(
			readSvelteOptions(appWith({ "svelte.config.js": "export const a = 1;" })),
		).rejects.toMatchObject({
			code: "svelte_config_invalid",
			message: expect.stringContaining("it has no default export that is an object"),
		});
	});
});
