// The types as an app gets them: from the package as it is published (its built declarations and
// `types/`), on TypeScript's last two minor versions. An app that checks every declaration file
// (`skipLibCheck: false`) and has no DOM, its components checked by svelte-check too; and the
// package's own type tests, which `pnpm check` runs on its source.

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

import { afterAll, beforeAll, describe, expect, it } from "@rstest/core";
import ts from "typescript";
import previousTs from "typescript-5.9";

const ROOT = path.resolve(import.meta.dirname, "../../..");
// In the package, where the app finds the package's dependencies, but outside `node_modules`, whose
// files svelte-check does not report on.
const WORK = path.join(ROOT, ".types-consumer");
const PACKAGE = path.join(WORK, "node_modules/@sohedra/lynx");
const APP = path.join(WORK, "app");
const TYPE_TESTS = path.join(WORK, "type-tests");

/** The type tests that reach the source past the public entries, which a published package hides. */
const INTERNAL_TYPE_TESTS = ["globals", "testing/test-page.ts"];

interface Manifest {
	name: string;
	publishConfig: { exports: Record<string, unknown> };
}

/** The package as `npm pack` would ship its types: the built declarations, `types/`, the manifest. */
function pack(): void {
	fs.rmSync(WORK, { recursive: true, force: true });
	const config = ts.getParsedCommandLineOfConfigFile(
		path.join(ROOT, "tsconfig.build.json"),
		{},
		{
			...ts.sys,
			onUnRecoverableConfigFileDiagnostic: (diagnostic) => {
				throw new Error(ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n"));
			},
		},
	)!;
	const program = ts.createProgram({
		rootNames: config.fileNames,
		options: { ...config.options, sourceMap: false, outDir: path.join(PACKAGE, "lib") },
	});
	const emitted = program.emit(undefined, undefined, undefined, true);
	expect(
		emitted.diagnostics.map((d) => ts.flattenDiagnosticMessageText(d.messageText, "\n")),
	).toEqual([]);
	fs.cpSync(path.join(ROOT, "types"), path.join(PACKAGE, "types"), { recursive: true });
	const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8")) as Manifest;
	fs.writeFileSync(
		path.join(PACKAGE, "package.json"),
		JSON.stringify({
			name: manifest.name,
			type: "module",
			exports: manifest.publishConfig.exports,
		}),
	);
	// A package of its own: inside this one, `@sohedra/lynx` would resolve to its source.
	fs.writeFileSync(
		path.join(WORK, "package.json"),
		JSON.stringify({ name: "app", type: "module" }),
	);
	fs.cpSync(path.join(ROOT, "tests/fixtures/types/app"), APP, { recursive: true });
	fs.cpSync(path.join(ROOT, "tests/types"), TYPE_TESTS, {
		recursive: true,
		filter: (from) =>
			!INTERNAL_TYPE_TESTS.includes(path.relative(path.join(ROOT, "tests/types"), from)),
	});
}

/** Each `.ts` file under `folder`. */
function filesIn(folder: string): string[] {
	return fs
		.readdirSync(folder, { recursive: true, encoding: "utf8" })
		.filter((file) => file.endsWith(".ts"))
		.map((file) => path.join(folder, file));
}

/** The diagnostics of a program, as `file:line TS1234 message` lines relative to the work folder. */
function diagnosticsOf(typescript: typeof ts, program: ts.Program): Diagnostic[] {
	return typescript.getPreEmitDiagnostics(program).map((diagnostic) => ({
		file: diagnostic.file ? path.relative(WORK, diagnostic.file.fileName) : "",
		line: diagnostic.file
			? diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start!).line + 1
			: 0,
		code: diagnostic.code,
		message: typescript.flattenDiagnosticMessageText(diagnostic.messageText, " "),
	}));
}

/** The package's type tests, with its own compiler options, by one version of TypeScript. */
function checkTypeTests(typescript: typeof ts): string[] {
	const config = typescript.getParsedCommandLineOfConfigFile(
		path.join(ROOT, "tsconfig.json"),
		{},
		{
			...typescript.sys,
			onUnRecoverableConfigFileDiagnostic: () => {},
		},
	)!;
	const program = typescript.createProgram({
		rootNames: filesIn(TYPE_TESTS),
		options: config.options,
	});
	return diagnosticsOf(typescript, program).map(
		({ file, line, code, message }) => `${file}:${line} TS${code} ${message}`,
	);
}

/**
 * The app's TypeScript files, checked with its tsconfig by one version of TypeScript, with
 * `overrides` over its options.
 */
function check(
	typescript: typeof ts,
	overrides: ts.CompilerOptions = {},
): { files: string[]; diagnostics: Diagnostic[] } {
	const config = typescript.getParsedCommandLineOfConfigFile(
		path.join(APP, "tsconfig.json"),
		{},
		{
			...typescript.sys,
			onUnRecoverableConfigFileDiagnostic: () => {},
		},
	)!;
	const program = typescript.createProgram({
		rootNames: config.fileNames.filter((file) => file.endsWith(".ts")),
		options: { ...config.options, ...overrides },
	});
	return {
		files: program.getSourceFiles().map((file) => file.fileName),
		diagnostics: diagnosticsOf(typescript, program),
	};
}

/** A diagnostic of the check, where it is relative to the work folder. */
interface Diagnostic {
	file: string;
	line: number;
	code: number;
	message: string;
}

/**
 * What the check reports that is the binding's or the app's. Svelte's and Rsbuild's declarations
 * name DOM types (`HTMLElement`, `Worker`), which an app without the DOM does not have: those
 * reports are theirs, and every one of them is a name not found.
 */
function ours(diagnostics: readonly Diagnostic[]): string[] {
	const theirs = (diagnostic: Diagnostic) =>
		!diagnostic.file.startsWith("app/") &&
		!diagnostic.file.startsWith("node_modules/@sohedra/lynx/") &&
		diagnostic.code === 2304;
	return diagnostics
		.filter((diagnostic) => !theirs(diagnostic))
		.map(({ file, line, code, message }) => `${file}:${line} TS${code} ${message}`);
}

/** What svelte-check reports for the app, as `file:line message` lines. */
function svelteCheck(): string[] {
	const require = createRequire(import.meta.url);
	const bin = path.join(
		path.dirname(require.resolve("svelte-check/package.json")),
		"bin/svelte-check",
	);
	let output: string;
	try {
		output = execFileSync(
			process.execPath,
			[
				bin,
				"--workspace",
				APP,
				"--tsconfig",
				path.join(APP, "tsconfig.json"),
				"--output",
				"machine",
			],
			{ encoding: "utf8" },
		);
	} catch (error) {
		// It exits with 1 when it finds an error, as the app's wrong component makes it.
		output = (error as { stdout: string }).stdout;
	}
	return output
		.split("\n")
		.filter((line) => / ERROR /.test(line))
		.map((line) => {
			const [, file, position, message] = /ERROR "([^"]+)" (\d+):\d+ "(.*)"$/.exec(line)!;
			// The whole message: with overloads, the first line only says none matched.
			return `${file}:${position} ${JSON.parse(`"${message}"`).replace(/\s+/g, " ")}`;
		});
}

describe("the types an app gets", { timeout: 120_000 }, () => {
	beforeAll(pack);
	afterAll(() => fs.rmSync(WORK, { recursive: true, force: true }));

	// Boundary: the previous minor's API is typed by its own declarations, the same for these calls.
	for (const typescript of [ts, previousTs as unknown as typeof ts]) {
		it(`check with every declaration file and no DOM on TypeScript ${typescript.versionMajorMinor}`, () => {
			expect(ours(check(typescript).diagnostics)).toEqual([]);
		});

		it(`pass the package's type tests on TypeScript ${typescript.versionMajorMinor}`, () => {
			expect(checkTypeTests(typescript)).toEqual([]);
		});
	}

	it("check with the base's skipLibCheck: nothing reported, no dependency's declarations either", () => {
		const { diagnostics } = check(ts, { skipLibCheck: true });
		expect(diagnostics.map(({ file, line, code }) => `${file}:${line} TS${code}`)).toEqual([]);
	});

	it("load no file of @lynx-js/types, which an app does not install", () => {
		const { files } = check(ts);
		expect(files.filter((file) => file.includes("/@lynx-js/types/"))).toEqual([]);
		expect(
			files.some((file) => file.endsWith("/@sohedra/lynx/types/generated/elements.d.ts")),
		).toBe(true);
	});

	it("let svelte-check pass what an app writes and name each mistake in its elements", () => {
		// One mistake on each line of the wrong component, and nothing else.
		const expected: [line: number, says: string][] = [
			[8, "No overload matches this call"],
			[9, `'"ontpa"' does not exist in type 'ViewAttributes'`],
			[10, `'"bindtap"' does not exist in type 'ViewAttributes'`],
			[11, "'(event: LynxScrollEvent) => undefined' is not assignable"],
			[12, "Property 'stopPropagation' does not exist"],
			[13, "Type 'number' is not assignable to type 'string'"],
			[14, "Type 'string' is not assignable to type 'MainThreadRef<any>"],
			[15, "Property 'preventDefault' does not exist on type 'MainThreadEvent<"],
			[16, "No overload matches this call"],
			[17, "Type '7' is not assignable"],
			[18, "No overload matches this call"],
			[19, "No overload matches this call"],
			[20, "No overload matches this call"],
		];
		const found = svelteCheck();
		expect(found.map((error) => error.split(" ")[0])).toEqual(
			expected.map(([line]) => `src/Wrong.svelte:${line}`),
		);
		found.forEach((error, index) => expect(error).toContain(expected[index]![1]));
	});
});
