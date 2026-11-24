// What an app's type check loads for `@sohedra/lynx/client`. An app built with Rsbuild alone (a
// framework's case) has no `@lynx-js/rspeedy`, so the ambient types must not reach for it.

import path from "node:path";

import { describe, expect, it } from "@rstest/core";
import ts from "typescript";

import { DOM_INSTEAD } from "../../../src/build/checks/dom-globals.ts";

const client = path.resolve(import.meta.dirname, "../../../types/client.d.ts");
const appFile = path.join(path.dirname(client), "app-under-test.ts");

const options: ts.CompilerOptions = {
	noEmit: true,
	strict: true,
	skipLibCheck: true,
	module: ts.ModuleKind.ESNext,
	moduleResolution: ts.ModuleResolutionKind.Bundler,
	allowImportingTsExtensions: true,
	// As an app's tsconfig has it, with no `types` of its own.
	types: [],
};

/** What an app does with the ambient types: asset imports, hot updates, components. */
const app = `
import logo from "./logo.png";
import Page from "./Page.svelte";
import { BROWSER, DEV } from "esm-env";
import "background-only";
const url: string = logo;
const component: typeof Page = Page;
const flags: boolean[] = [BROWSER, DEV];
import.meta.webpackHot?.accept();
export { url, component, flags };
`;

function check(
	rootNames: string[],
	code = app,
	compilerOptions = options,
): { files: string[]; diagnostics: string[] } {
	const host = ts.createCompilerHost(compilerOptions);
	const getSourceFile = host.getSourceFile.bind(host);
	host.getSourceFile = (file, ...rest) =>
		// TypeScript names files with `/`, which Windows' paths have not.
		path.normalize(file) === appFile
			? ts.createSourceFile(file, code, ts.ScriptTarget.ESNext)
			: getSourceFile(file, ...rest);
	const program = ts.createProgram({
		rootNames: [...rootNames, appFile],
		options: compilerOptions,
		host,
	});
	const files = program.getSourceFiles().map((file) => file.fileName.split(path.sep).join("/"));
	const diagnostics = ts
		.getPreEmitDiagnostics(program)
		.map((diagnostic) => ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n"));
	return { files, diagnostics };
}

describe("@sohedra/lynx/client", () => {
	it("loads no file of @lynx-js/rspeedy, and brings the build's own ambient types", () => {
		const { files } = check([client]);
		expect(files.filter((file) => file.includes("/@lynx-js/rspeedy/"))).toEqual([]);
		expect(files.some((file) => file.endsWith("/@rsbuild/core/types.d.ts"))).toBe(true);
		expect(files.some((file) => file.endsWith("/@rspack/core/module.d.ts"))).toBe(true);
	});

	it("types asset imports, import.meta.webpackHot, .svelte imports, esm-env and background-only", () => {
		expect(check([client]).diagnostics).toEqual([]);
	});

	it("does not declare the thread flags, which come from the env entry", () => {
		const checker = ts.createProgram({ rootNames: [client], options }).getTypeChecker();
		for (const flag of ["__MAIN_THREAD__", "__BACKGROUND__", "__LEPUS__", "__JS__", "__DEV__"]) {
			expect(
				checker.resolveName(flag, undefined, ts.SymbolFlags.Value, false),
				flag,
			).toBeUndefined();
		}
	});

	it("declares the globals a Lynx thread has, and not what the polyfill fills or no thread has", () => {
		// The base tsconfig's built-ins: the language, without the DOM.
		const checker = ts
			.createProgram({ rootNames: [client], options: { ...options, lib: ["lib.es2025.d.ts"] } })
			.getTypeChecker();
		const declared = (name: string): boolean =>
			checker.resolveName(name, undefined, ts.SymbolFlags.Value, false) !== undefined;
		const threads = [
			"console",
			"setTimeout",
			"clearTimeout",
			"setInterval",
			"clearInterval",
			"requestAnimationFrame",
			"cancelAnimationFrame",
			"queueMicrotask",
			"lynx",
			"SystemInfo",
			"NativeModules",
		];
		expect(threads.filter((name) => !declared(name))).toEqual([]);
		// lynx-core's own, which Lynx types with the DOM's types: the polyfill's standard ones instead.
		const lynx = checker.getTypeOfSymbol(
			checker.resolveName("lynx", undefined, ts.SymbolFlags.Value, false)!,
		);
		expect(
			["fetch", "EventSource", "ReadableStream"].filter((member) => lynx.getProperty(member)),
		).toEqual([]);
		expect(lynx.getProperty("createSelectorQuery")).toBeDefined();
		const polyfill = ["URL", "fetch", "TextEncoder", "AbortController", "structuredClone"];
		const nowhere = ["window", "document", "localStorage", "navigator", "self", "crypto"];
		expect([...polyfill, ...nowhere].filter(declared)).toEqual([]);
	});

	it("type-checks each use of `lynx` the build's messages tell an app to write", () => {
		const writes = Object.values(DOM_INSTEAD).flatMap((text) =>
			[...text.matchAll(/`(lynx\.[^`]+)`/g)].map((match) => match[1]!),
		);
		expect(writes.length).toBeGreaterThan(0);
		const app = writes.map((write, index) => `export const use${index} = ${write};`).join("\n");
		// The base tsconfig's built-ins: the language, without the DOM.
		expect(check([client], app, { ...options, lib: ["lib.es2025.d.ts"] }).diagnostics).toEqual([]);
	});
});
