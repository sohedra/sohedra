// The script checks read every shape of JavaScript and TypeScript for the names it declares and the
// globals it reads: a declared name is never reported, wherever it is declared, and a global is
// reported wherever it is read.

import { describe, expect, it } from "@rstest/core";

import { checkModule } from "../../../../src/build/checks/module-checks.ts";
import { APP_ROOT, inApp } from "../app.ts";
import { component } from "../compiling.ts";

/** The codes a module's checks report, in order. */
function codesOf(text: string, file = "shape.ts"): string[] {
	try {
		checkModule({ file: inApp(file), text }, APP_ROOT);
		return [];
	} catch (error) {
		return [...(error as Error).message.matchAll(/https:\/\/sohedra\.com\/e\/(\w+)/g)].map(
			(match) => match[1]!,
		);
	}
}

const DOM = "dom_not_on_lynx";

describe("a name the script declares", () => {
	it.each([
		[
			"a destructured parameter with a default",
			"export function f({ a = 1 }: { a?: number }, [b] = [2], ...document: number[]) { return document; }",
		],
		[
			"a class, an enum, a namespace",
			"class document {}\nenum window { A }\nnamespace location { export const a = 1; }\nexport const all = [document, window, location];",
		],
		["an import alias", 'import history = require("./h");\nexport const h = history;'],
		["a named function expression", "export const f = function document() { return document; };"],
		["a nested block's let", "export function f() { { let screen = 1; } return screen; }"],
	])("is not reported: %s", (_, text) => {
		expect(codesOf(text)).toEqual([]);
	});
});

describe("a global the script reads", () => {
	it.each([
		["in a default value", "export function f(a = document) { return a; }", [DOM]],
		[
			"in a destructuring's default",
			"export const { a = window, ...rest } = {} as Record<string, unknown>;",
			[DOM],
		],
		["in an array pattern's default", "export const [a = location] = [] as unknown[];", [DOM]],
		["in a computed key", "export const o = { [document.title]: 1 };", [DOM]],
		[
			"in a pattern's computed key",
			"export const { [location.href]: a } = {} as Record<string, unknown>;",
			[DOM],
		],
		[
			"in a parameter property's default",
			"export class A {\n\tconstructor(private value = window) {}\n}",
			[DOM],
		],
		[
			"in a computed member, and assigned to a member",
			"const o: Record<string, unknown> = {};\no[screen.width] = 1;\no.a = history;",
			[DOM, DOM],
		],
		[
			"in a class's parts",
			"export class A extends HTMLElement {\n\t[screen.width] = 1;\n\tstatic x = history;\n\tget y() { return innerWidth; }\n}",
			[DOM, DOM, DOM, DOM],
		],
		[
			"in an assignment's pattern",
			"let a: unknown;\n({ a = document } = {});\n[a = window] = [];",
			[DOM, DOM],
		],
		["as an assignment's target", "export function f() { innerHeight = 1; }", [DOM]],
		[
			"behind a label, in a loop",
			"outer: for (const a of [1]) { if (a) continue outer; else break outer; }\nexport const d = document;",
			[DOM],
		],
		["in a dynamic import", "export const load = () => import(String(location));", [DOM]],
		["in a catch's default", "try {} catch ({ a = document }) {}", [DOM]],
		["in an export assignment", "export = document;", [DOM]],
		[
			"in a type assertion and a non-null",
			"export const a = (window as unknown)!;\nexport const b = <unknown>document;",
			[DOM, DOM],
		],
		[
			"through a typed callee in a main-thread function",
			"function save() {}\nexport function f() {\n\t'main thread';\n\t(save as () => void)();\n}",
			["plain_function_in_main_thread_function"],
		],
	] as const)("is reported %s", (_, text, codes) => {
		expect(codesOf(text)).toEqual(codes);
	});

	it("is not read in a type, a declaration-only function or `import.meta`", () => {
		expect(
			codesOf(
				"declare function f(a: Document): Window;\nexport const u = import.meta.url;\nexport * from './x';\nexport const l = () => import('./lazy.ts');\nexport const t = typeof (1 + 2);",
			),
		).toEqual([]);
	});

	it("is checked first by `in` on lynx, or by a read of self", () => {
		expect(
			codesOf(
				"export function f() {\n\t'main thread';\n\tif ('getJSModule' in lynx) lynx.getJSModule('A');\n}",
			),
		).toEqual([]);
		expect(codesOf("export const n = self.TextEncoder ? new TextEncoder() : null;")).toEqual([]);
	});

	it("as a member of lynx both threads have is fine on either", () => {
		expect(
			codesOf(
				"export function f() {\n\t'main thread';\n\tlynx.reportError(new Error('a'));\n}\nlynx.reportError(new Error('b'));",
			),
		).toEqual([]);
	});

	it("as a member of a local named lynx is the local's", () => {
		expect(
			codesOf(
				"const lynx = { querySelector: () => null };\nexport const q = lynx.querySelector();",
			),
		).toEqual([]);
	});
});

describe("the silencing comment", () => {
	it("silences a plain function's call on its line", () => {
		expect(
			codesOf(
				"function save() {}\nexport function f() {\n\t'main thread';\n\t// svelte-lynx-ignore plain_function_in_main_thread_function\n\tsave();\n}",
			),
		).toEqual([]);
	});
});

describe("a module the checks don't read", () => {
	it("is one that doesn't parse, or isn't a script", () => {
		expect(codesOf("export const = ;")).toEqual([]);
		expect(codesOf("document", "data.json")).toEqual([]);
	});
});

describe("a component's markup", () => {
	it("declares a {@const}, an {#await}'s value and error, and reads their expressions", async () => {
		const source =
			"{#await Promise.resolve(1) then location}<text>{location}</text>{:catch history}<text>{history}</text>{/await}\n{#each [1] as row}{@const screen = row}<text>{screen}{document}</text>{/each}";
		await expect(component(source, { checks: true })).rejects.toThrow(/dom_not_on_lynx/);
		const quiet = source.replace("{document}", "");
		await expect(component(quiet, { checks: true })).resolves.toBeDefined();
	});
});
