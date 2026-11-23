// An entry that resolves by thread has a side for each: the main thread's, which the first frame and
// main-thread functions import, and the background's, which declares its types. Both give the same
// values, so code that imports one runs on either thread.

import path from "node:path";

import { describe, expect, it } from "@rstest/core";
import ts from "typescript";

const ROOT = path.resolve(import.meta.dirname, "../../..");

/** Each entry that resolves by thread, with its main thread's side and its background's. */
const SIDES = {
	".": ["src/first-frame/root-entry.ts", "src/background/root-entry.ts"],
	"./host": ["src/first-frame/host-entry.ts", "src/background/host-entry.ts"],
} as const;

const files = Object.values(SIDES).flat();
const program = ts.createProgram({
	rootNames: files.map((file) => path.join(ROOT, file)),
	options: { allowImportingTsExtensions: true, noEmit: true, module: ts.ModuleKind.ESNext },
});
const checker = program.getTypeChecker();

/** The names of the values `file` exports, sorted. */
function valuesOf(file: string): string[] {
	const source = program.getSourceFile(path.join(ROOT, file))!;
	const module = checker.getSymbolAtLocation(source)!;
	return checker
		.getExportsOfModule(module)
		.filter((symbol) => {
			const target =
				symbol.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(symbol) : symbol;
			return (target.flags & ts.SymbolFlags.Value) !== 0;
		})
		.map((symbol) => symbol.name)
		.toSorted();
}

describe("an entry that resolves by thread", () => {
	it.each(Object.entries(SIDES))("%s gives the same values on both threads", (_, sides) => {
		const [mainThread, background] = sides;
		expect(valuesOf(mainThread).length).toBeGreaterThan(0);
		expect(valuesOf(mainThread)).toEqual(valuesOf(background));
	});
});
