// The binding's own code that runs on Lynx's threads, checked as an app's is: with the base
// tsconfig's built-ins (`@sohedra/lynx/tsconfig`), so neither the DOM's names nor a newer language's
// type-check there and then throw on a device.

import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "@rstest/core";
import ts from "typescript";

const ROOT = path.resolve(import.meta.dirname, "../../..");

/** The folders of `src/` whose code runs on a thread of Lynx. */
const ON_LYNX = [
	"background",
	"main-thread",
	"first-frame",
	"wire",
	"gesture",
	"env",
	"svelte/runtime",
];

/** The base tsconfig an app extends. */
function baseOptions(): ts.CompilerOptions {
	const file = path.join(ROOT, "types/tsconfig.base.json");
	const { config } = ts.readConfigFile(file, ts.sys.readFile);
	return ts.convertCompilerOptionsFromJson(
		(config as { compilerOptions: unknown }).compilerOptions,
		ROOT,
	).options;
}

/** The package's own compiler options, which `pnpm check` reads. */
function packageOptions(): ts.CompilerOptions {
	return ts.getParsedCommandLineOfConfigFile(
		path.join(ROOT, "tsconfig.json"),
		{},
		{ ...ts.sys, onUnRecoverableConfigFileDiagnostic: () => {} },
	)!.options;
}

describe("the binding's thread code", { timeout: 60_000 }, () => {
	it("leaves the DOM out of the base tsconfig an app extends", () => {
		const { lib } = baseOptions();
		expect(lib).toEqual(["lib.es2021.d.ts"]);
	});

	it("type-checks with the base tsconfig's built-ins, no DOM and no Node", () => {
		const files = ON_LYNX.flatMap((folder) =>
			fs
				.readdirSync(path.join(ROOT, "src", folder), { recursive: true, encoding: "utf8" })
				.filter((file) => file.endsWith(".ts"))
				.map((file) => path.join(ROOT, "src", folder, file)),
		);
		const program = ts.createProgram({
			rootNames: [...files, path.join(ROOT, "types/client.d.ts")],
			options: { ...packageOptions(), lib: baseOptions().lib, types: [] },
		});
		const found = ts.getPreEmitDiagnostics(program).map((diagnostic) => {
			const where = diagnostic.file
				? `${path.relative(ROOT, diagnostic.file.fileName)}:${diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start!).line + 1}`
				: "";
			return `${where} TS${diagnostic.code} ${ts.flattenDiagnosticMessageText(diagnostic.messageText, " ")}`;
		});
		expect(found).toEqual([]);
		// A program that found none of them would pass too.
		expect(
			program.getSourceFiles().some((file) => file.fileName.endsWith("main-thread/apply.ts")),
		).toBe(true);
	});
});
