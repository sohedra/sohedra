// Rune modules (`.svelte.js`, `.svelte.ts`) compile once per thread; what Svelte warns about them
// is reported once.

import { describe, expect, it } from "@rstest/core";

import { compileRuneModule } from "../../../../src/build/index.ts";
import { APP_ROOT, inApp } from "../app.ts";

const compile = (
	source: string,
	thread: "background" | "main-thread",
	sourceMap = false,
	development = false,
) =>
	compileRuneModule(source, {
		filename: inApp("counter.svelte.js"),
		thread,
		root: APP_ROOT,
		development,
		sourceMap,
	});

const counter = "export class Counter { n = $state(0); get double() { return this.n * 2; } }\n";

describe("a rune module", () => {
	it("compiles for the renderer on the background, with state that signals", () => {
		const { code } = compile(counter, "background");
		expect(code).toContain("svelte/internal/client");
		expect(code).toContain("$.state(0)");
	});

	it("compiles for Svelte's server renderer on the main thread, with plain values", () => {
		const { code } = compile(counter, "main-thread");
		expect(code).toContain("svelte/internal/server");
		expect(code).toMatch(/n = 0;/);
	});

	it("leaves Svelte's development code out of the main thread's copy, as a component does", () => {
		const source = "let count = $state(0);\n$inspect(count);\nexport const read = () => count;\n";
		const mainThread = compile(source, "main-thread", false, true);
		expect(mainThread.code).toBe(compile(source, "main-thread").code);
		expect(mainThread.code).not.toContain("inspect");
		expect(compile(source, "background", false, true).code).toContain("$.inspect(");
	});

	it("reports its warnings once, from the background thread's copy", () => {
		// `state_referenced_locally`, on both threads' compiles.
		const source = "let count = $state(0);\nexport const initial = count;\n";
		const background = compile(source, "background");
		const mainThread = compile(source, "main-thread");
		expect(background.warnings).toHaveLength(1);
		expect(background.warnings[0]!.code).toBe("state_referenced_locally");
		expect(background.warnings[0]!.message).toContain("counter.svelte.js:2:");
		expect(mainThread.warnings).toEqual([]);
	});

	it("gives a map to the file, only when asked", () => {
		expect(compile(counter, "background").map).toBeUndefined();
		const { map } = compile(counter, "background", true);
		expect(map!.sources).toEqual(["counter.svelte.js"]);
		expect(map!.sourcesContent).toEqual([counter]);
	});

	it("throws Svelte's error as the build's message, at its place", () => {
		let message = "";
		try {
			compile("let a = $state(0, 1);\n", "background");
		} catch (error) {
			message = (error as Error).message;
		}
		expect(message).toContain("counter.svelte.js:1:");
		expect(message).toContain("https://svelte.dev/e/");
		expect(message).toContain("1: let a = $state(0, 1);");
	});
});
