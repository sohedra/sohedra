// What the element types cost the editor: the type instantiations TypeScript makes to check a
// reference component, as the Svelte language tools see it. The editor checks again as the
// developer types, so the cost is paid on every edit. Counts differ between TypeScript versions:
// this one is measured on the package's own.

import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

import { describe, expect, it } from "@rstest/core";
import { svelte2tsx } from "svelte2tsx";
import ts from "typescript";

const ROOT = path.resolve(import.meta.dirname, "../../..");
const FIXTURES = path.join(ROOT, "tests/fixtures/types/budget");

/**
 * The most instantiations checking the reference component may make: measured at 14,443 on
 * TypeScript 6.0, about 5,700 of it for the page and the rest for the component generic over the
 * tag. The room left is for the types to grow, not for a conditional or key-remapping type per
 * element, which costs tens of thousands for each tag a component writes; the generated-file test
 * catches a plain mapped type, which costs less.
 */
const BUDGET = 20_000;

/** A component as the language tools check it: the TypeScript svelte2tsx makes of it. */
function asTypeScript(file: string): string {
	return svelte2tsx(fs.readFileSync(file, "utf8"), {
		filename: file,
		isTsFile: true,
		mode: "ts",
		typingsNamespace: "svelteLynx",
	}).code;
}

/** The instantiations checking `component` makes, past those of checking an empty component. */
function instantiations(component: string): number {
	const require = createRequire(import.meta.url);
	const shims = path.dirname(require.resolve("svelte2tsx/package.json"));
	const files = new Map([
		[path.join(FIXTURES, "Empty.svelte.ts"), asTypeScript(path.join(FIXTURES, "Empty.svelte"))],
		[path.join(FIXTURES, `${component}.ts`), asTypeScript(path.join(FIXTURES, component))],
	]);
	const options: ts.CompilerOptions = {
		strict: true,
		noEmit: true,
		skipLibCheck: true,
		target: ts.ScriptTarget.ES2022,
		module: ts.ModuleKind.ESNext,
		moduleResolution: ts.ModuleResolutionKind.Bundler,
		allowImportingTsExtensions: true,
		types: [],
	};
	const host = ts.createCompilerHost(options);
	const read = host.getSourceFile.bind(host);
	host.getSourceFile = (file, ...rest) => {
		const text = files.get(file);
		return text === undefined
			? read(file, ...rest)
			: ts.createSourceFile(file, text, ts.ScriptTarget.ES2022);
	};
	const exists = host.fileExists.bind(host);
	host.fileExists = (file) => files.has(file) || exists(file);
	const program = ts.createProgram({
		rootNames: [
			path.join(shims, "svelte-shims-v4.d.ts"),
			path.join(ROOT, "types/client.d.ts"),
			...files.keys(),
		],
		options,
		host,
	});
	const [empty, measured] = [...files.keys()].map((file) => program.getSourceFile(file)!);
	const check = (file: ts.SourceFile) => {
		const diagnostics = program.getSemanticDiagnostics(file);
		expect(diagnostics.map((d) => ts.flattenDiagnosticMessageText(d.messageText, " "))).toEqual([]);
	};
	check(empty!);
	const before = program.getInstantiationCount();
	check(measured!);
	return program.getInstantiationCount() - before;
}

describe("the element types", () => {
	it("check a page of four elements and a component generic over the tag within the budget", () => {
		expect(instantiations("Reference.svelte")).toBeLessThanOrEqual(BUDGET);
	});
});
