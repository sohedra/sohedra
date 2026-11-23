// The package's manifest: what it exports, what it publishes instead, what the bundler may drop,
// and which versions it pins.

import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

import { describe, expect, it } from "@rstest/core";

import { DECLARED_ENTRIES } from "../../../scripts/declarations/index.ts";
import { isPeerRange } from "../../../scripts/floor.ts";

const ROOT = path.resolve(import.meta.dirname, "../../..");

interface Manifest {
	exports: Record<string, string | Record<string, string>>;
	publishConfig: { exports: Record<string, string | Record<string, string>> };
	sideEffects: string[];
	dependencies: Record<string, string>;
	peerDependencies: Record<string, string>;
	engines: Record<string, string>;
}

const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8")) as Manifest;

/** Each source file of the package, with its code: its text without its comments. */
const sources = fs
	.readdirSync(path.join(ROOT, "src"), { recursive: true, encoding: "utf8" })
	.filter((file) => file.endsWith(".ts"))
	.map((file) => ({
		file: `src/${file.split(path.sep).join("/")}`,
		code: fs
			.readFileSync(path.join(ROOT, "src", file), "utf8")
			.replace(/\/\*[\s\S]*?\*\//g, "")
			.replace(/^\s*\/\/.*$/gm, ""),
	}));
const ENTRIES = [
	"./config/rsbuild",
	"./config/rstest",
	"./config/svelte",
	"./env",
	"./experimental",
	"./gesture",
	"./internal/renderer",
];

/** The internal entries: what compiled code and the build import by name. */
const INTERNAL = [
	"./internal/renderer",
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

	it("is published as built files, each public entry typed by its bundled declarations", () => {
		for (const entry of ENTRIES) {
			const source = manifest.exports[entry] as string;
			const built = source.replace("./src/", "./lib/").replace(/\.ts$/, "");
			const declared = DECLARED_ENTRIES[entry]?.declarations;
			expect(manifest.publishConfig.exports[entry]).toEqual({
				types: declared ? `./${declared}` : `${built}.d.ts`,
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

	it("starts the page through the package's own entry, which resolves by thread", () => {
		expect(manifest.exports["."]).toEqual({
			worker: "./src/first-frame/root-entry.ts",
			default: "./src/background/root-entry.ts",
		});
		expect(manifest.publishConfig.exports["."]).toEqual({
			types: "./types/bundled/index.d.ts",
			worker: "./lib/first-frame/root-entry.js",
			default: "./lib/background/root-entry.js",
		});
		expect(Object.keys(manifest.exports)).not.toContain("./internal/page");
	});

	it("gives the host's data and events through an entry that resolves by thread", () => {
		expect(manifest.exports["./host"]).toEqual({
			worker: "./src/first-frame/host-entry.ts",
			default: "./src/background/host-entry.ts",
		});
		expect(manifest.publishConfig.exports["./host"]).toEqual({
			types: "./types/bundled/host.d.ts",
			worker: "./lib/first-frame/host-entry.js",
			default: "./lib/background/host-entry.js",
		});
	});

	it("names the renderer's entry in one file of the source, which the others import", () => {
		const naming = sources.filter(({ code }) => /["'`][^"'`\n]*\/internal\/renderer/.test(code));
		expect(naming.map(({ file }) => file)).toEqual(["src/wire/names.ts"]);
	});

	it("exports its manifest, which tools read, as it is and as published", () => {
		expect(manifest.exports["./package.json"]).toBe("./package.json");
		expect(manifest.publishConfig.exports["./package.json"]).toBe("./package.json");
		const require = createRequire(path.join(ROOT, "package.json"));
		expect(require.resolve("@sohedra/lynx/package.json")).toBe(path.join(ROOT, "package.json"));
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

	it("writes the encoder's pinned version in the manifest only, not in the source or its comments", () => {
		const pin = manifest.dependencies["@lynx-js/tasm"]!;
		const files = fs.readdirSync(path.join(ROOT, "src"), { recursive: true, encoding: "utf8" });
		const naming = files.filter(
			(file) =>
				file.endsWith(".ts") && fs.readFileSync(path.join(ROOT, "src", file), "utf8").includes(pin),
		);
		expect(naming).toEqual([]);
	});
});

describe("peerDependencies", () => {
	it("run from the version tested to the end of its major (for 0.x or a tilde range, its minor), or of a later one after a widening", () => {
		const peers = Object.entries(manifest.peerDependencies);
		expect(peers.filter(([, range]) => !isPeerRange(range))).toEqual([]);
	});
});

describe("engines", () => {
	it("names even Node.js lines, each from a floor, in the same words as the README", () => {
		expect(manifest.engines["node"]).toMatch(
			/^\^\d*[02468]\.\d+\.\d+(?: \|\| \^\d*[02468]\.\d+\.\d+)*$/,
		);
		const readme = fs.readFileSync(path.join(ROOT, "README.md"), "utf8").replace(/\s+/g, " ");
		expect(readme).toContain(`Node.js \`${manifest.engines["node"]}\``);
	});
});
