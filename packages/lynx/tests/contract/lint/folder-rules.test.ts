// The table of which folder of the binding may import which, as the lint config enforces it.
// Each case writes one file that imports another folder and checks that lint accepts or refuses it.

import path from "node:path";

import { describe, expect, it } from "@rstest/core";

import { lint, reported } from "./lint-fixture.ts";
import type { Problem } from "./lint-fixture.ts";

const SRC = "packages/lynx/src";
const RULE = "eslint(no-restricted-imports)";
const NODE_RULE = "import(no-nodejs-modules)";

/** Folder to the folders it may import, each through its index.ts. */
const MAY_IMPORT: Record<string, string[]> = {
	wire: [],
	build: ["wire", "svelte/build"],
	background: ["wire", "svelte/runtime"],
	"main-thread": ["wire"],
	"first-frame": ["wire"],
	"svelte/build": [],
	"svelte/runtime": ["wire"],
	testing: ["wire", "background", "main-thread", "first-frame", "svelte/runtime"],
	gesture: ["wire"],
	env: ["wire"],
};

const FOLDERS = Object.keys(MAY_IMPORT);
const slug = (folder: string): string => folder.replace("/", "-");

/**
 * How a file reaches another folder: through its index.ts, through another file, as a folder (which
 * resolves to its index.ts), or by a path that wanders (`./../wire/index.ts`).
 */
type Form = "index" | "inner" | "folder" | "wandering";

/** The import of `target` in the given form, written in a file inside `from` (a folder, or one under it). */
function importOf(from: string, target: string, form: Form): string {
	const relative = path.posix.relative(`${SRC}/${from}`, `${SRC}/${target}`);
	const specifier = {
		index: `${relative}/index.ts`,
		inner: `${relative}/inner.ts`,
		folder: relative,
		wandering: `./${relative}/index.ts`,
	}[form];
	return `import "${specifier}";\n`;
}

const HOW: Record<Form, string> = {
	index: "",
	inner: "'s inner files",
	folder: " as a folder",
	wandering: " by a path that wanders",
};

describe("imports between the binding's folders", () => {
	const files: Record<string, string> = {};
	const cases: { file: string; from: string; target: string; form: Form }[] = [];
	for (const from of FOLDERS) {
		for (const target of FOLDERS) {
			if (target === from) continue;
			for (const form of Object.keys(HOW) as Form[]) {
				const file = `${SRC}/${from}/probe-${form}-${slug(target)}.ts`;
				files[file] = importOf(from, target, form);
				cases.push({ file, from, target, form });
			}
		}
	}
	// A folder inside a program (the presets are inside build/) reaches the others one level higher.
	const presets = `${SRC}/build/presets`;
	files[`${presets}/probe-wire.ts`] = importOf("build/presets", "wire", "index");
	files[`${presets}/probe-svelte.ts`] = importOf("build/presets", "svelte/build", "index");
	files[`${presets}/probe-background.ts`] = importOf("build/presets", "background", "index");
	files[`${presets}/probe-wire-folder.ts`] = importOf("build/presets", "wire", "folder");
	files[`${presets}/probe-wire-wandering.ts`] = 'import "../../build/../wire/index.ts";\n';
	const refused = reported(lint(files), RULE);

	for (const { file, from, target, form } of cases) {
		const allowed = form === "index" && (MAY_IMPORT[from] ?? []).includes(target);
		it(`${from} ${allowed ? "may" : "may not"} import ${target}${HOW[form]}`, () => {
			expect(refused.has(file)).toBe(!allowed);
		});
	}

	it("lets build/presets/ import what build/ may, through each index.ts", () => {
		expect(refused.has(`${presets}/probe-wire.ts`)).toBe(false);
		expect(refused.has(`${presets}/probe-svelte.ts`)).toBe(false);
		expect(refused.has(`${presets}/probe-background.ts`)).toBe(true);
		expect(refused.has(`${presets}/probe-wire-folder.ts`)).toBe(true);
		expect(refused.has(`${presets}/probe-wire-wandering.ts`)).toBe(true);
	});
});

describe("the manifest of the Svelte contract", () => {
	// src/svelte/index.ts is the folder's face: the manifest file is not imported directly.
	const OUTSIDE = FOLDERS.filter((folder) => !folder.startsWith("svelte/"));
	const manifestFrom = (from: string): string =>
		`import "${path.posix.relative(`${SRC}/${from}`, `${SRC}/svelte`)}/manifest.ts";\n`;
	const files: Record<string, string> = {};
	for (const folder of [...OUTSIDE, "build/presets"]) {
		files[`${SRC}/${folder}/probe-manifest.ts`] = manifestFrom(folder);
	}
	const refused = reported(lint(files), RULE);

	for (const folder of [...OUTSIDE, "build/presets"]) {
		it(`stops ${folder} import svelte/manifest.ts`, () => {
			expect(refused.has(`${SRC}/${folder}/probe-manifest.ts`)).toBe(true);
		});
	}
});

describe("imports of Svelte and Node", () => {
	const NODE_FOLDERS = ["build", "svelte/build", "testing"];
	// Node's modules, with and without the `node:` prefix.
	const NODE_IMPORTS = { prefixed: "node:fs", fs: "fs", path: "path", subpath: "fs/promises" };
	const files: Record<string, string> = {};
	for (const folder of FOLDERS) {
		files[`${SRC}/${folder}/probe-internals.ts`] = 'import "svelte/internal/client";\n';
		files[`${SRC}/${folder}/probe-compiler.ts`] = 'import "svelte/compiler";\n';
		for (const [name, specifier] of Object.entries(NODE_IMPORTS)) {
			files[`${SRC}/${folder}/probe-node-${name}.ts`] = `import "${specifier}";\n`;
		}
	}
	const problems = lint(files);
	const refused = new Set([...reported(problems, RULE), ...reported(problems, NODE_RULE)]);

	for (const folder of FOLDERS) {
		const inSvelte = folder.startsWith("svelte/");
		it(`${inSvelte ? "lets" : "stops"} ${folder} import Svelte's internals and compiler`, () => {
			expect(refused.has(`${SRC}/${folder}/probe-internals.ts`)).toBe(!inSvelte);
			expect(refused.has(`${SRC}/${folder}/probe-compiler.ts`)).toBe(!inSvelte);
		});
		it(`${NODE_FOLDERS.includes(folder) ? "lets" : "stops"} ${folder} import Node's modules`, () => {
			for (const name of Object.keys(NODE_IMPORTS)) {
				expect(refused.has(`${SRC}/${folder}/probe-node-${name}.ts`), name).toBe(
					!NODE_FOLDERS.includes(folder),
				);
			}
		});
	}
});

describe("import cycles", () => {
	it("are refused inside a folder", () => {
		const problems: Problem[] = lint({
			[`${SRC}/background/first.ts`]: 'import "./second.ts";\nexport const first = 1;\n',
			[`${SRC}/background/second.ts`]: 'import "./first.ts";\nexport const second = 2;\n',
		});
		expect(reported(problems, "import(no-cycle)").size).toBeGreaterThan(0);
	});
});
