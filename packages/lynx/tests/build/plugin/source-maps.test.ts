// The source maps of a build list the binding's own files in `ignoreList`, and no file of the app.

import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { afterAll, beforeAll, describe, expect, it } from "@rstest/core";

import { PACKAGE_ROOT } from "../../../src/build/plugin/layers.ts";
import { bindingSourceIndexes, isBindingSource } from "../../../src/build/plugin/source-maps.ts";
import { buildApp, cleanBuild } from "../build-app.ts";
import type { AppBuild } from "../build-app.ts";

/** An absolute path on this system: `/app/…` here, `D:\\app\\…` on Windows. */
const absolute = (file: string): string => path.resolve("/", file);
/** The `file:` URL of an absolute path on this system. */
const url = (file: string): string => pathToFileURL(file).href;

describe("which sources are the binding's", () => {
	it("takes the files of the package's own folders and of the installed package", () => {
		expect(isBindingSource(url(path.join(PACKAGE_ROOT, "src/env/index.ts")))).toBe(true);
		expect(isBindingSource(url(path.join(PACKAGE_ROOT, "lib/env/index.js")))).toBe(true);
		expect(isBindingSource(url(absolute("app/node_modules/@sohedra/lynx/lib/env/index.js")))).toBe(
			true,
		);
		expect(
			isBindingSource(absolute("app/node_modules/.pnpm/x/node_modules/@sohedra/lynx/lib/a.js")),
		).toBe(true);
	});

	it("leaves out the app's files, other packages and what is no path", () => {
		expect(isBindingSource(url(absolute("app/src/index.ts")))).toBe(false);
		expect(
			isBindingSource(url(path.join(PACKAGE_ROOT, "tests/fixtures/build/apps/app/index.ts"))),
		).toBe(false);
		expect(isBindingSource(url(absolute("app/node_modules/svelte/src/index.js")))).toBe(false);
		expect(isBindingSource("webpack://app/./src/index.ts")).toBe(false);
		expect(isBindingSource("file://app/../src/index.ts")).toBe(false);
	});

	it("lists the indexes of the binding's sources", () => {
		expect(
			bindingSourceIndexes([
				url(absolute("app/src/index.ts")),
				url(path.join(PACKAGE_ROOT, "src/env/index.ts")),
				url(absolute("app/node_modules/@sohedra/lynx/lib/a.js")),
			]),
		).toEqual([1, 2]);
	});
});

interface DebugMetadata {
	artifacts: {
		debugSources: { kind: string; map: { sources: string[]; ignoreList?: number[] } }[];
	}[];
}

describe("a build with source maps", () => {
	let build: AppBuild;
	let maps: { sources: string[]; ignoreList?: number[] }[];

	beforeAll(async () => {
		build = await buildApp("env", {
			outside: true,
			rsbuild: { output: { sourceMap: { js: "source-map" } } },
		});
		const metadata = JSON.parse(
			fs.readFileSync(path.join(build.dist, "out", ".lynx", "main", "debug-metadata.json"), "utf8"),
		) as DebugMetadata;
		maps = metadata.artifacts.flatMap((artifact) =>
			artifact.debugSources
				.filter((source) => source.kind === "source-map")
				.map((source) => source.map),
		);
	}, 180_000);
	afterAll(() => cleanBuild(build));

	it("builds, with a map for each thread", () => {
		expect(build.error + build.messages).toBe("");
		expect(maps.length).toBeGreaterThanOrEqual(2);
	});

	it("lists the binding's files in ignoreList, and none of the app's", () => {
		const listed = maps.flatMap((map) =>
			(map.ignoreList ?? []).map((index) => map.sources[index]!),
		);
		expect(listed.length).toBeGreaterThan(0);
		// Windows names the files with `\\`.
		for (const source of listed) expect(source.replaceAll("\\", "/")).toContain("/src/");
		for (const source of listed) expect(isBindingSource(source)).toBe(true);
		const ignored = new Set(listed);
		const app = maps
			.flatMap((map) => map.sources)
			.filter((source) => source.replaceAll("\\", "/").endsWith("/app/branches.ts"));
		expect(app.length).toBeGreaterThan(0);
		for (const source of app) expect(ignored.has(source)).toBe(false);
	});
});
