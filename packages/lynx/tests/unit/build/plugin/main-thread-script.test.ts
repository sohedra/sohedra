// What the main thread's script needs from Rspack's settings.

import { describe, expect, it } from "@rstest/core";

import {
	appSetsSplitChunks,
	isLynxEnvironment,
	mainThreadScriptWhole,
	splitBackgroundOnly,
} from "../../../../src/build/plugin/main-thread-script.ts";

describe("isLynxEnvironment", () => {
	it("takes `lynx` and `lynx-*`, and no other environment", () => {
		expect(isLynxEnvironment("lynx")).toBe(true);
		expect(isLynxEnvironment("lynx-android")).toBe(true);
		expect(isLynxEnvironment("web")).toBe(false);
		expect(isLynxEnvironment("node")).toBe(false);
	});
});

describe("appSetsSplitChunks", () => {
	it("is false for an app that says nothing, and for `all-in-one`", () => {
		expect(appSetsSplitChunks({}, "lynx")).toBe(false);
		expect(
			appSetsSplitChunks({ performance: { chunkSplit: { strategy: "all-in-one" } } }, "lynx"),
		).toBe(false);
	});

	it("is true for any `splitChunks`, `false` too, and any other strategy", () => {
		expect(appSetsSplitChunks({ splitChunks: false }, "lynx")).toBe(true);
		expect(
			appSetsSplitChunks(
				{ performance: { chunkSplit: { strategy: "split-by-experience" } } },
				"lynx",
			),
		).toBe(true);
	});

	it("reads the environment's own setting before the global one", () => {
		const config = {
			splitChunks: false as const,
			environments: { lynx: { splitChunks: { chunks: "all" as const } } },
		};
		expect(appSetsSplitChunks(config, "lynx")).toBe(true);
		expect(
			appSetsSplitChunks({ environments: { other: { splitChunks: false as const } } }, "lynx"),
		).toBe(false);
	});
});

/** A chunk as far as the selection reads it. */
function chunk(runtime: string[], initial: boolean, name?: string): never {
	// Boundary: a test chunk with the members the selection reads.
	return { runtime: new Set(runtime), canBeInitial: () => initial, name } as never;
}

describe("splitBackgroundOnly", () => {
	const chunks = (split: ReturnType<typeof splitBackgroundOnly>) =>
		split.chunks as (c: never) => boolean;
	const mainThread = chunk(["main__main-thread"], true, "main__main-thread");
	const background = chunk(["main"], true, "main");
	const lazyBackground = chunk(["main"], false);

	it("never selects the main thread's chunks, whatever `chunks` says", () => {
		expect(chunks(splitBackgroundOnly({ chunks: "all" }))(mainThread)).toBe(false);
		expect(chunks(splitBackgroundOnly({ chunks: "all" }))(background)).toBe(true);
	});

	it("never selects a lazy bundle's background chunk: the template names those alike", () => {
		expect(chunks(splitBackgroundOnly({ chunks: "all" }))(lazyBackground)).toBe(false);
	});

	it("follows the app's `initial`, regular expression and function", () => {
		expect(chunks(splitBackgroundOnly({ chunks: "initial" }))(background)).toBe(true);
		expect(chunks(splitBackgroundOnly({ chunks: /^main$/ }))(background)).toBe(true);
		expect(chunks(splitBackgroundOnly({ chunks: /^other$/ }))(background)).toBe(false);
		expect(chunks(splitBackgroundOnly({ chunks: () => false }))(background)).toBe(false);
	});

	it("applies to a cache group's own `chunks` and the fallback group's", () => {
		const split = splitBackgroundOnly({
			chunks: "all",
			cacheGroups: { vendor: { chunks: "all" }, plain: { minSize: 1 } },
			fallbackCacheGroup: { chunks: "all" },
		});
		const group = (split.cacheGroups as Record<string, { chunks?: (c: never) => boolean }>)[
			"vendor"
		]!;
		expect(group.chunks?.(mainThread)).toBe(false);
		expect(
			(split.cacheGroups as Record<string, { chunks?: unknown }>)["plain"]?.chunks,
		).toBeUndefined();
		const fallback = split.fallbackCacheGroup?.chunks as (c: never) => boolean;
		expect(fallback(mainThread)).toBe(false);
	});
});

describe("mainThreadScriptWhole", () => {
	const utils = (name: string) => ({ environment: { name } }) as never;

	it("leaves another environment's config as it is", () => {
		const config = { output: { iife: true } };
		mainThreadScriptWhole(() => {})(config, utils("web"));
		expect(config).toEqual({ output: { iife: true } });
	});

	it("sets `output.iife` to false in a Lynx environment, and says so once an app set it to another value", () => {
		const said: string[] = [];
		const config = { output: { iife: true } };
		mainThreadScriptWhole((message) => said.push(message))(config, utils("lynx"));
		expect(config.output.iife).toBe(false);
		expect(said).toHaveLength(1);
		expect(said[0]).toContain(
			"`output.iife` is false for both threads, so your value (true) is ignored.",
		);
	});

	it("says nothing when the app leaves `output.iife` alone, or sets false", () => {
		const said: string[] = [];
		for (const output of [undefined, { iife: false }]) {
			mainThreadScriptWhole((message) => said.push(message))({ output }, utils("lynx"));
		}
		expect(said).toEqual([]);
	});
});
