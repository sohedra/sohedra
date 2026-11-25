// The Vitest preset's plugins on Vite's own pipeline, in this process: how each thread's copy of a
// module resolves and compiles. The suite under Vitest (tests/build/vitest-run.test.ts) runs the
// same plugins end to end.

import path from "node:path";

import { afterAll, beforeAll, describe, expect, it } from "@rstest/core";
import { createServer } from "vite";
import type { DevEnvironment, ViteDevServer } from "vite";

import { RUNTIME_FILES } from "../../../../src/build/plugin/layers.ts";
import { resolveOptions } from "../../../../src/build/plugin/options.ts";
import { vitePlugins } from "../../../../src/build/presets/vite-plugin.ts";
import type { VitePlugins } from "../../../../src/build/presets/vite-plugin.ts";
import { APP_ROOT } from "../app.ts";

const library = path.join(APP_ROOT, "tests/fixtures/library");
const vitest = path.join(APP_ROOT, "tests/vitest/fixtures");
const MAIN = "?lynx-main-thread";
/** A path as Vite names a file: with `/` between folders, which Windows' paths have not. */
const slashed = (file: string): string => file.replaceAll("\\", "/");

let server: ViteDevServer;
let environment: DevEnvironment;
let run: VitePlugins;

/** What `source`, imported from `importer`, resolves to. */
async function resolve(source: string, importer: string): Promise<string | undefined> {
	return (await environment.pluginContainer.resolveId(source, importer))?.id;
}

/** The code of the module `id`, as the plugins and Vite left it. */
async function transform(id: string): Promise<string> {
	const result = await environment.transformRequest(id);
	return result?.code ?? "";
}

describe("the Vitest preset's plugins", { timeout: 60_000 }, () => {
	beforeAll(async () => {
		run = vitePlugins(
			resolveOptions({
				define: {
					mainThread: { __WHERE__: '"main"' },
					background: { __WHERE__: '"background"' },
				},
				dedupe: ["fast-check"],
			}),
			{ given: {} },
		);
		server = await createServer({
			root: APP_ROOT,
			configFile: false,
			logLevel: "silent",
			appType: "custom",
			server: { middlewareMode: true, ws: false, watch: null },
			plugins: run.plugins,
		});
		environment = server.environments.ssr;
	});
	afterAll(() => server.close());

	it("hangs each background component's first-frame copy on it, which the main thread draws", async () => {
		const component = path.join(library, "Counter.svelte");
		const code = await transform(component);
		expect(code).toContain("Counter.svelte?first-frame");
		const copy = await resolve("./Counter.svelte?first-frame", component);
		expect(copy).toBe(`${slashed(component)}?first-frame`);
		const source = await transform(copy!);
		expect(source).toContain(`Counter.svelte${MAIN}`);
		expect(source).toContain("mountPage");
	});

	it("resolves the main thread's modules as the main thread does, each a copy of its own", async () => {
		const importer = `${path.join(library, "Counter.svelte")}${MAIN}`;
		expect(await resolve("@sohedra/lynx", importer)).toBe(
			`${RUNTIME_FILES.firstFrameEntry}${MAIN}`,
		);
		expect(await resolve("@sohedra/lynx", path.join(library, "Counter.svelte"))).toMatch(
			/background[\\/]root-entry\.ts$/,
		);
		expect(await resolve("./counted.ts", importer)).toBe(
			`${slashed(path.join(library, "counted.ts"))}${MAIN}`,
		);
		expect(await resolve("svelte/internal/server", importer)).toMatch(
			new RegExp(`${escape(MAIN)}$`),
		);
		// Named by its path from the root, as a module from Vitest's cache names it.
		expect(await resolve(`/tests/fixtures/library/counted.ts${MAIN}`, importer)).toBe(
			`${slashed(path.join(library, "counted.ts"))}${MAIN}`,
		);
	});

	it("gives the background the binding's svelte/events and the app's own copies", async () => {
		const importer = path.join(library, "Heard.svelte");
		expect(await resolve("svelte/events", importer)).toBe(RUNTIME_FILES.svelteEvents);
		expect(await resolve("svelte/events", RUNTIME_FILES.svelteEvents)).not.toBe(
			RUNTIME_FILES.svelteEvents,
		);
		expect(await resolve("background-only", importer)).toBe(RUNTIME_FILES.backgroundOnly);
		expect(await resolve("esm-env", importer)).toMatch(/esm-env/);
		expect(await resolve("fast-check", importer)).toMatch(/fast-check/);
		// Not an entry of the binding: the request goes the usual way, which refuses it.
		await expect(resolve("@sohedra/lynx/nothing", importer)).rejects.toThrow("./nothing");
	});

	it("compiles a component for each thread, and a module's main-thread functions", async () => {
		const component = path.join(library, "MainThreadCall.svelte");
		expect(await transform(component)).toContain("_wkltId");
		expect(await transform(`${component}${MAIN}`)).not.toContain("Symbol.for");
		expect(await transform(path.join(library, "triple.ts"))).toContain("_wkltId");
	});

	it("compiles a rune module's TypeScript, keeping its state field", async () => {
		const code = await transform(path.join(vitest, "counter.svelte.ts"));
		expect(code).not.toContain("private readonly");
		expect(code).toMatch(/\.state\(/);
	});

	it("replaces each thread's constants in its copy, and stubs a background-only module there", async () => {
		const module = path.join(library, "counted.ts");
		expect(await transform(`${module}${MAIN}`)).toContain('"main thread"');
		const stub = await transform(`${path.join(library, "analytics.ts")}${MAIN}`);
		expect(stub).toContain("stub(");
		expect(await transform(path.join(library, "analytics.ts"))).not.toContain("stub(");
	});

	it("leaves a style sheet of the main thread's copies unmarked, and names a file outside the root", async () => {
		const importer = `${path.join(library, "Styled.svelte")}${MAIN}`;
		expect(await resolve("./styled.css", importer)).toBe(slashed(path.join(library, "styled.css")));
		const outside = RUNTIME_FILES.firstFrameEntry;
		// Vite's name of a file outside the root: `/@fs/` and its path, which on Windows starts with
		// its drive.
		expect(await resolve(`/@fs/${outside.replace(/^\//, "")}${MAIN}`, importer)).toBe(
			`${outside}${MAIN}`,
		);
	});

	it("leaves the copies out with firstFrame: false", async () => {
		const plain = await createServer({
			root: APP_ROOT,
			configFile: false,
			logLevel: "silent",
			appType: "custom",
			server: { middlewareMode: true, ws: false, watch: null },
			plugins: vitePlugins(resolveOptions({ firstFrame: false }), { given: {} }).plugins,
		});
		try {
			const result = await plain.environments.ssr.transformRequest(
				path.join(library, "Counter.svelte"),
			);
			expect(result?.code).not.toContain("?first-frame");
		} finally {
			await plain.close();
		}
	});

	it("patches Svelte's own text as the build does", async () => {
		const props = path.join(
			path.dirname((await resolve("svelte/package.json", APP_ROOT + "/package.json")) ?? ""),
			"src/internal/client/reactivity/props.js",
		);
		expect(await transform(props)).not.toBe("");
	});

	it("gives the cache key what the compile read: the Svelte options and the installed Svelte", () => {
		const inputs = JSON.parse(run.compileInputs()) as { svelte: string; version: string };
		expect(inputs.svelte).toMatch(/[\\/]svelte[\\/]package\.json$/);
		expect(inputs.version).toContain('"name": "svelte"');
		expect(run.compileInputs()).toContain("compilerOptions");
	});

	it("names a module that is neither at its path nor under the root as its path", async () => {
		const importer = `${path.join(library, "Counter.svelte")}${MAIN}`;
		await expect(resolve(`/nowhere/at/all.ts${MAIN}`, importer)).resolves.toBe(
			// On Windows, on the drive of the root.
			`${slashed(path.resolve("/nowhere/at/all.ts"))}${MAIN}`,
		);
	});

	it("says where Svelte's text moved when a patch no longer finds its place", async () => {
		const [main] = run.plugins;
		const handler = main!.transform as (code: string, id: string) => Promise<unknown>;
		const props = "/x/node_modules/svelte/src/internal/client/reactivity/props.js";
		await expect(handler.call({}, "export const nothing = 1;", props)).rejects.toThrow(/props\.js/);
	});
});

function escape(text: string): string {
	return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
