// The loader for main-thread functions in plain scripts: each script is compiled as written,
// before anything else compiles it, so both threads give a function the same id. It sees every
// module of the build, `node_modules` included, so a module without the directive must cost
// nothing.

import { describe, expect, it } from "@rstest/core";

import mainThreadFunctionsLoader from "../../../../src/build/loaders/main-thread-functions.ts";
import { runLoader } from "./loader-context.ts";

const script = `export function onScroll(event) {
	'main thread';
	return event.detail.scrollTop;
}
`;

const load = (source: string, thread: string, run: object = {}, map?: unknown) =>
	runLoader(
		mainThreadFunctionsLoader,
		source,
		{ file: "handlers.ts", options: { thread }, ...run },
		map,
	);

describe("a module with no main-thread function", () => {
	it("is returned at once, as it is, with the map it came with", async () => {
		const map = { version: 3, mappings: "AAAA", sources: ["a.ts"] };
		const result = await load("export const a = 1;\n", "background", {}, map);
		expect(result.sync).toBe(true);
		expect(result.code).toBe("export const a = 1;\n");
		expect(result.map).toBe(map);
	});

	it("is not parsed, so a file Svelte's own source or a library has costs a text search", async () => {
		// A script that does not parse, and has no directive: the loader never reads it as code.
		const result = await load("export const = ;", "background", { file: "broken.ts" });
		expect(result.error).toBeNull();
		expect(result.code).toBe("export const = ;");
	});

	it("is left alone when its path is Svelte's own source, whatever it holds", async () => {
		const result = await load(script, "background", {
			file: "../node_modules/svelte/src/internal/client/index.js",
		});
		expect(result.sync).toBe(true);
		expect(result.code).toBe(script);
	});
});

describe("a module with a main-thread function", () => {
	it("gives both threads the same id", async () => {
		const ids = async (thread: string) =>
			[...String((await load(script, thread)).code).matchAll(/_wkltId: "([^"]+)"/g)].map(
				(match) => match[1],
			);
		expect((await ids("background")).length).toBe(1);
		expect(await ids("main-thread")).toEqual(await ids("background"));
	});

	it("registers the body on the main thread only", async () => {
		expect((await load(script, "main-thread")).code).toContain(
			'registerWorkletInternal("main-thread"',
		);
		expect((await load(script, "background")).code).not.toContain("registerWorkletInternal");
	});

	it("hands the bundler a map composed with the one it came with", async () => {
		const { map } = await load(script, "background", { sourceMap: true });
		expect(map).toMatchObject({ version: 3 });
	});

	it("declines hot updates: the main thread would keep the old function", async () => {
		const hot = await load(script, "background", { options: { thread: "background", hot: true } });
		expect(hot.code).toContain("import.meta.webpackHot.decline()");
		const cold = await load(script, "background");
		expect(cold.code).not.toContain("webpackHot");
	});

	it("fails with the build's message for a function it cannot take", async () => {
		const { error } = await load("class A { m() { 'main thread'; } }", "background");
		expect(error).toMatchObject({ code: "main_thread_function_method" });
	});
});
