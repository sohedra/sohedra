// The types an app gets for what it imports: each import declares the globals it installs on
// either thread, and nothing else, so `URL` type-checks after `import "@sohedra/lynx-polyfill/url"`
// and is a type error without it. An app's own file is checked as Sohedra's base tsconfig has it:
// the language through ES2025 and no DOM; and with the DOM or Node's types beside the package's,
// whose declarations of the same globals the base's `skipLibCheck` leaves alone.

import path from "node:path";

import { describe, expect, it } from "@rstest/core";
import ts from "typescript";

import { installedGlobals } from "../../scripts/types/generate.ts";
import { PACKAGE_NAME, subpaths } from "./entry-script.ts";

const ROOT = path.resolve(import.meta.dirname, "../..");
// In the package, which resolves its own name through its `exports`.
const APP_FILE = path.join(ROOT, "tests/package/app-under-test.ts");

/** Sohedra's base tsconfig, as far as the globals go. */
const BASE: ts.CompilerOptions = {
	noEmit: true,
	strict: true,
	target: ts.ScriptTarget.ES2025,
	lib: ["lib.es2025.d.ts"],
	types: [],
	module: ts.ModuleKind.ESNext,
	moduleResolution: ts.ModuleResolutionKind.Bundler,
	skipLibCheck: false,
};

/** A program of the app file holding `code`, with `options` over the base's. */
function program(code: string, options: ts.CompilerOptions = {}): ts.Program {
	const all = { ...BASE, ...options };
	const host = ts.createCompilerHost(all);
	const getSourceFile = host.getSourceFile.bind(host);
	host.getSourceFile = (file, ...rest) =>
		path.normalize(file) === APP_FILE
			? ts.createSourceFile(file, code, ts.ScriptTarget.ESNext)
			: getSourceFile(file, ...rest);
	return ts.createProgram({ rootNames: [APP_FILE], options: all, host });
}

/** What the check reports, as `TS1234 message` lines. */
function diagnostics(checked: ts.Program): string[] {
	return ts
		.getPreEmitDiagnostics(checked)
		.map(
			(diagnostic) =>
				`TS${diagnostic.code} ${ts.flattenDiagnosticMessageText(diagnostic.messageText, " ")}`,
		);
}

/** The globals an app file sees as values, of `names`. */
function valuesSeen(checked: ts.Program, names: readonly string[]): string[] {
	const checker = checked.getTypeChecker();
	return names.filter(
		(name) => checker.resolveName(name, undefined, ts.SymbolFlags.Value, false) !== undefined,
	);
}

const installed = installedGlobals();
const everyGlobal = [...new Set([...installed.values()].flat())].sort();

/** What an app writes with the baseline's globals. */
const APP = `
import "${PACKAGE_NAME}";
const url = new URL("/inbox?unread=1", "https://example.com");
const unread: string | null = url.searchParams.get("unread");
for (const [name, value] of url.searchParams) void [name, value];
const controller = new AbortController();
const signal: AbortSignal = AbortSignal.any([controller.signal, AbortSignal.timeout(1000)]);
const response: Promise<unknown> = fetch(url, { signal }).then((answer) => answer.json());
const bytes: Uint8Array = new TextEncoder().encode("é");
const text: string = new TextDecoder().decode(bytes);
const copy: { at: Date } = structuredClone({ at: new Date() });
const elapsed: number = performance.now();
const encoded: string = btoa("hi");
self.addEventListener("error", (event) => void event);
const agent: string = navigator.userAgent;
queueMicrotask(() => {});
reportError(new Error("x"));
const body = new Response("x").body;
if (body) for await (const chunk of body) void chunk;
export { unread, response, text, copy, elapsed, encoded, agent };
`;

describe("the types of each import", () => {
	it.each(subpaths())(
		`import "${PACKAGE_NAME}%s" declares the globals it installs, and no other`,
		(subpath) => {
			const checked = program(`import "${PACKAGE_NAME}${subpath}";\nexport {};\n`);
			expect(diagnostics(checked)).toEqual([]);
			// The language's own globals (`Iterator`) are ES2025's, which the base's lib declares.
			const own = (installed.get(subpath) ?? []).filter((name) => name !== "Iterator");
			expect(valuesSeen(checked, everyGlobal)).toEqual(own);
		},
	);

	it("leave every global the package fills a type error without an import", () => {
		const checked = program("export {};\n");
		expect(valuesSeen(checked, everyGlobal)).toEqual([]);
		expect(
			diagnostics(program("export const address = new URL('https://example.com');\n")),
		).toEqual(["TS2304 Cannot find name 'URL'."]);
	});

	it("check what an app writes with the baseline, with every declaration file checked", () => {
		expect(diagnostics(program(APP))).toEqual([]);
	});

	it("check the same beside the DOM's and Node's types, as the base's skipLibCheck has it", () => {
		expect(
			diagnostics(program(APP, { lib: ["lib.es2025.d.ts", "lib.dom.d.ts"], skipLibCheck: true })),
		).toEqual([]);
		expect(diagnostics(program(APP, { types: ["node"], skipLibCheck: true }))).toEqual([]);
	});
});
