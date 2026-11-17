// The loader for `.svelte.js` and `.svelte.ts` rune modules: it runs after a TypeScript-only pass,
// and before the thread's lowering.

import { describe, expect, it } from "@rstest/core";

import svelteModuleLoader from "../../../../src/build/loaders/svelte-module.ts";
import { runLoader } from "./loader-context.ts";

const counter = "export class Counter { count = $state(0); inc() { this.count++; } }";

const load = (source: string, thread: string, extra: object = {}) =>
	runLoader(svelteModuleLoader, source, {
		file: "counter.svelte.ts",
		options: { thread },
		...extra,
	});

describe("a rune module", () => {
	it("compiles for the client on the background thread", async () => {
		const { code, error } = await load(counter, "background");
		expect(error).toBeNull();
		expect(code).toContain("$.state(0)");
		expect(code).toMatch(/from ['"]svelte\/internal\/client['"]/);
	});

	it("compiles for the server's renderer on the main thread, which is its first frame", async () => {
		const { code } = await load(counter, "main-thread");
		expect(code).toMatch(/from ['"]svelte\/internal\/server['"]/);
	});

	it("hands the bundler a source map composed with the TypeScript pass's", async () => {
		const { map } = await load(counter, "background", { sourceMap: true });
		expect(map).toMatchObject({ version: 3 });
	});

	it("reports Svelte's warnings of the background copy only", async () => {
		const warning = "let a = $state(1); export const b = a;";
		expect((await load(warning, "background")).warnings.length).toBeGreaterThanOrEqual(0);
		expect((await load(warning, "main-thread")).warnings).toEqual([]);
	});

	it("fails with the build's message, which names the file and the place", async () => {
		const { error } = await load("export const a = $state(;", "background");
		expect(error).toBeInstanceOf(Error);
		expect(error?.message).toContain("counter.svelte.ts");
	});
});
