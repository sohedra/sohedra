// The package's manifest: what it exports, what it publishes instead, what the bundler may drop,
// and which versions it pins.

import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "@rstest/core";

const ROOT = path.resolve(import.meta.dirname, "../../..");

interface Manifest {
	exports: Record<string, string | Record<string, string>>;
	publishConfig: { exports: Record<string, string | Record<string, string>> };
	sideEffects: string[];
	dependencies: Record<string, string>;
}

const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8")) as Manifest;
const ENTRIES = [
	"./config/rsbuild",
	"./config/rstest",
	"./config/svelte",
	"./env",
	"./experimental",
	"./gesture",
	"./internal/renderer",
];

/**
 * The internal entries: what compiled code and the build import by name, and the page's start,
 * which the page's entry imports until the public page entry replaces it and it is deleted. The
 * page's start resolves by thread, to the main thread's copy under `worker`.
 */
const INTERNAL = [
	"./internal/renderer",
	"./internal/page",
	"./internal/main-thread-functions",
	"./internal/window-size",
];

describe("exports", () => {
	it("has the public entries, pointing at source files", () => {
		for (const entry of ENTRIES) {
			const target = manifest.exports[entry];
			expect(typeof target, entry).toBe("string");
			expect(
				fs.existsSync(path.join(ROOT, target as string)),
				`${entry} -> ${target as string}`,
			).toBe(true);
		}
	});

	it("is published as built files with their types, an entry each", () => {
		for (const entry of ENTRIES) {
			const source = manifest.exports[entry] as string;
			const built = source.replace("./src/", "./lib/").replace(/\.ts$/, "");
			expect(manifest.publishConfig.exports[entry]).toEqual({
				types: `${built}.d.ts`,
				default: `${built}.js`,
			});
		}
	});

	it("has no internal entry but the ones compiled code and the build import", () => {
		const internal = Object.keys(manifest.exports).filter((entry) =>
			entry.startsWith("./internal/"),
		);
		expect(internal.filter((entry) => !INTERNAL.includes(entry))).toEqual([]);
	});

	it("starts the page through an entry that resolves by thread, built and as source", () => {
		expect(manifest.exports["./internal/page"]).toEqual({
			worker: "./src/first-frame/page.ts",
			default: "./src/background/page-entry.ts",
		});
		expect(manifest.publishConfig.exports["./internal/page"]).toEqual({
			types: "./lib/background/page-entry.d.ts",
			worker: "./lib/first-frame/page.js",
			default: "./lib/background/page-entry.js",
		});
	});

	it("publishes the same entries as it exports", () => {
		expect(Object.keys(manifest.publishConfig.exports).toSorted()).toEqual(
			Object.keys(manifest.exports).toSorted(),
		);
	});
});

describe("sideEffects", () => {
	it("names the files that must stay in a bundle although nothing reads their exports, in source and built form", () => {
		const sources = manifest.sideEffects.filter((pattern) => pattern.startsWith("./src/"));
		const built = manifest.sideEffects.filter((pattern) => pattern.startsWith("./lib/"));
		expect(sources.length).toBeGreaterThan(0);
		expect(built).toEqual(
			sources.map((pattern) => pattern.replace("./src/", "./lib/").replace(/\.ts$/, ".js")),
		);
		for (const pattern of sources) {
			const base = pattern.replace(/\/\*\*$/, "");
			expect(fs.existsSync(path.join(ROOT, base)), pattern).toBe(true);
		}
	});
});

describe("dependencies", () => {
	it("pins the template encoder exactly, and the engine's other plugins by range", () => {
		expect(manifest.dependencies["@lynx-js/tasm"]).toMatch(/^\d+\.\d+\.\d+$/);
		expect(manifest.dependencies["@lynx-js/template-webpack-plugin"]).toMatch(/^\^/);
		expect(manifest.dependencies["@lynx-js/rsbuild-plugin"]).toMatch(/^\^/);
	});
});
