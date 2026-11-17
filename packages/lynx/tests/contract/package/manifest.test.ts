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
const ENTRIES = ["./config/rsbuild", "./config/rstest", "./config/svelte", "./env"];

describe("exports", () => {
	it("has the public entries of the build and of the thread constants, pointing at source files", () => {
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
