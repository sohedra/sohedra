// The table of which folder of the binding may import which, as the lint config enforces it.
// Each case writes one file that imports another folder and checks that lint accepts or refuses it.

import path from "node:path";

import { describe, expect, it } from "@rstest/core";

import { lint, reported } from "./lint-fixture.ts";
import type { Problem } from "./lint-fixture.ts";

const SRC = "packages/lynx/src";
const RULE = "eslint(no-restricted-imports)";

/** Folder to the folders it may import, each through its index.ts. */
const MAY_IMPORT: Record<string, string[]> = {
	wire: [],
	build: ["wire", "svelte/build"],
	background: ["wire", "svelte/runtime"],
	"main-thread": ["wire"],
	"first-frame": ["wire"],
	"svelte/build": [],
	"svelte/runtime": [],
	testing: ["wire", "background", "main-thread", "first-frame", "svelte/runtime"],
	gesture: ["wire"],
	host: ["wire"],
	env: ["wire"],
};

const FOLDERS = Object.keys(MAY_IMPORT);
const slug = (folder: string): string => folder.replace("/", "-");

/** The import of `target`'s `file`, written in a file inside `from` (a folder, or one under it). */
function importOf(from: string, target: string, file: string): string {
	return `import "${path.posix.relative(`${SRC}/${from}`, `${SRC}/${target}`)}/${file}";\n`;
}

describe("imports between the binding's folders", () => {
	const files: Record<string, string> = {};
	const cases: { file: string; from: string; target: string; face: boolean }[] = [];
	for (const from of FOLDERS) {
		for (const target of FOLDERS) {
			if (target === from) continue;
			for (const face of [true, false]) {
				const file = `${SRC}/${from}/probe-${face ? "index" : "inner"}-${slug(target)}.ts`;
				files[file] = importOf(from, target, face ? "index.ts" : "inner.ts");
				cases.push({ file, from, target, face });
			}
		}
	}
	// A folder inside a program (the presets are inside build/) reaches the others one level higher.
	files[`${SRC}/build/presets/probe-wire.ts`] = importOf("build/presets", "wire", "index.ts");
	files[`${SRC}/build/presets/probe-svelte.ts`] = importOf(
		"build/presets",
		"svelte/build",
		"index.ts",
	);
	files[`${SRC}/build/presets/probe-background.ts`] = importOf(
		"build/presets",
		"background",
		"index.ts",
	);
	const refused = reported(lint(files), RULE);

	for (const { file, from, target, face } of cases) {
		const allowed = face && (MAY_IMPORT[from] ?? []).includes(target);
		it(`${from} ${allowed ? "may" : "may not"} import ${target}${face ? "" : "'s inner files"}`, () => {
			expect(refused.has(file)).toBe(!allowed);
		});
	}

	it("lets build/presets/ import what build/ may", () => {
		expect(refused.has(`${SRC}/build/presets/probe-wire.ts`)).toBe(false);
		expect(refused.has(`${SRC}/build/presets/probe-svelte.ts`)).toBe(false);
		expect(refused.has(`${SRC}/build/presets/probe-background.ts`)).toBe(true);
	});
});

describe("imports of Svelte and Node", () => {
	const NODE_FOLDERS = ["build", "svelte/build", "testing"];
	const files: Record<string, string> = {};
	for (const folder of FOLDERS) {
		files[`${SRC}/${folder}/probe-internals.ts`] = 'import "svelte/internal/client";\n';
		files[`${SRC}/${folder}/probe-compiler.ts`] = 'import "svelte/compiler";\n';
		files[`${SRC}/${folder}/probe-node.ts`] = 'import "node:fs";\n';
	}
	const refused = reported(lint(files), RULE);

	for (const folder of FOLDERS) {
		const inSvelte = folder.startsWith("svelte/");
		it(`${inSvelte ? "lets" : "stops"} ${folder} import Svelte's internals and compiler`, () => {
			expect(refused.has(`${SRC}/${folder}/probe-internals.ts`)).toBe(!inSvelte);
			expect(refused.has(`${SRC}/${folder}/probe-compiler.ts`)).toBe(!inSvelte);
		});
		it(`${NODE_FOLDERS.includes(folder) ? "lets" : "stops"} ${folder} import Node's modules`, () => {
			expect(refused.has(`${SRC}/${folder}/probe-node.ts`)).toBe(!NODE_FOLDERS.includes(folder));
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
