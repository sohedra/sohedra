// No DOM type in the code that runs on a Lynx thread. The package has one tsconfig, and its `DOM`
// lib is there for the test library (`src/testing/`), which runs on a jsdom document; `no-undef`
// keeps DOM values out of the thread folders, and this keeps DOM types out: Lynx's threads have
// neither `Element` nor `Node`.

import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "@rstest/core";
import ts from "typescript";

const ROOT = path.resolve(import.meta.dirname, "../../..");
const SRC = path.join(ROOT, "src");

/** The folders whose code runs on a Lynx thread. */
const THREAD_FOLDERS = [
	"wire",
	"background",
	"main-thread",
	"first-frame",
	"svelte/runtime",
	"gesture",
	"env",
];

/** Every `.ts` file under `folder`. */
function filesIn(folder: string): string[] {
	if (!fs.existsSync(folder)) return [];
	return fs.readdirSync(folder, { withFileTypes: true }).flatMap((entry) => {
		const full = path.join(folder, entry.name);
		if (entry.isDirectory()) return filesIn(full);
		return entry.name.endsWith(".ts") ? [full] : [];
	});
}

/** Each name in `files` whose declaration is in TypeScript's DOM lib, as `file:line name`. */
function domNamesIn(files: string[]): string[] {
	const config = ts.readConfigFile(path.join(ROOT, "tsconfig.json"), (file) =>
		ts.sys.readFile(file),
	);
	const { options } = ts.parseJsonConfigFileContent(config.config, ts.sys, ROOT);
	const program = ts.createProgram({ rootNames: files, options });
	const checker = program.getTypeChecker();
	const found: string[] = [];
	for (const file of files) {
		const source = program.getSourceFile(file);
		if (!source) continue;
		const visit = (node: ts.Node): void => {
			if (ts.isIdentifier(node)) {
				const declarations = checker.getSymbolAtLocation(node)?.getDeclarations() ?? [];
				const fromDom =
					declarations.length > 0 &&
					declarations.every((declaration) =>
						/lib\.dom(\.[\w.]+)?\.d\.ts$/.test(declaration.getSourceFile().fileName),
					);
				if (fromDom) {
					const { line } = source.getLineAndCharacterOfPosition(node.getStart());
					found.push(`${path.relative(ROOT, file)}:${line + 1} ${node.text}`);
				}
			}
			ts.forEachChild(node, visit);
		};
		visit(source);
	}
	return found;
}

describe("the code that runs on a Lynx thread", { timeout: 60_000 }, () => {
	it("names no DOM type", () => {
		const files = THREAD_FOLDERS.flatMap((folder) => filesIn(path.join(SRC, folder)));
		expect(domNamesIn(files)).toEqual([]);
	});

	it("is checked by a rule that finds a DOM type where one is named", () => {
		const fixture = path.join(ROOT, "tests/fixtures/dom-types/uses-dom.ts");
		expect(domNamesIn([fixture]).map((entry) => entry.split(" ")[1])).toEqual([
			"Node",
			"Element",
			"parentElement",
		]);
	});
});
