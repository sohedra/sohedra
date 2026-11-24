// Shapes of valid code that the checks must leave alone, and their counterparts that still fail:
// the function handed to `runOnBackground`, a `try` with a `catch`, a build constant named like an
// element function, a global the app installs itself, a renamed flag and an early return, and a
// fill package the app imports.

import { describe, expect, it } from "@rstest/core";

import { globalsInstalledBy } from "../../../../src/build/checks/fill-packages.ts";
import type { ModuleFills } from "../../../../src/build/checks/fills-store.ts";
import { checkModule } from "../../../../src/build/checks/module-checks.ts";
import { APP_ROOT, inApp } from "../app.ts";
import { component } from "../compiling.ts";

/** A plain module of the app, checked. */
function moduleOf(text: string): ModuleFills {
	return checkModule({ file: inApp("shape.ts"), text }, APP_ROOT);
}

/** The codes a module's checks report, in order. */
function codesOf(text: string): string[] {
	try {
		moduleOf(text);
		return [];
	} catch (error) {
		return [...(error as Error).message.matchAll(/https:\/\/sohedra\.com\/e\/(\w+)/g)].map(
			(match) => match[1]!,
		);
	}
}

describe("the function a main-thread function hands runOnBackground", () => {
	it("is the background's code: its background APIs and plain functions are fine", () => {
		const text = [
			'import { runOnBackground } from "@sohedra/lynx";',
			"function save() {}",
			"export function onTap() {",
			"\t'main thread';",
			"\trunOnBackground(() => save())();",
			'\trunOnBackground(() => { void fetch("/log"); })();',
			"\trunOnBackground((x: unknown) => NativeModules.Log.write(x))(1);",
			'\trunOnBackground(() => lynx.getJSModule("Events"))();',
			"}",
		].join("\n");
		expect(codesOf(text)).toEqual([]);
	});

	it("reports the main thread's API inside it", () => {
		const text =
			"export function onTap() {\n\t'main thread';\n\trunOnBackground(() => __FlushElementTree())();\n}";
		expect(codesOf(text)).toEqual(["main_thread_api_in_background"]);
	});
});

describe("a read inside try … catch", () => {
	it("is a feature check: the catch handles what it throws", () => {
		expect(codesOf("let d: unknown;\ntry { d = document.title; } catch {}")).toEqual([]);
		const money =
			'export function money(n: number) {\n\ttry { return new Intl.NumberFormat("en").format(n); }\n\tcatch { return "€" + n.toFixed(2); }\n}';
		expect(codesOf(money)).toEqual([]);
	});

	it("still reports a read in the catch block, or in a try without one", () => {
		expect(codesOf("try { f(); } catch { console.log(document.title); }")).toEqual([
			"dom_not_on_lynx",
		]);
		expect(codesOf("try { document.title; } finally {}")).toEqual(["dom_not_on_lynx"]);
	});
});

describe("a name shaped like an element function", () => {
	it("is the app's own unless Lynx registers it", () => {
		expect(codesOf("export const version = () => __AppVersion;")).toEqual([]);
		expect(codesOf("export const theme = () => __HostConfig.theme;")).toEqual([]);
		expect(
			codesOf(
				"export const a = () => __CreateView(0);\nexport const b = () => __SetAttribute(a, 'x', 1);",
			),
		).toEqual(["main_thread_api_in_background", "main_thread_api_in_background"]);
	});
});

describe("a global the app installs itself", () => {
	it("is what the module installs, by assignment or defineProperty", () => {
		const { installs } = moduleOf(
			'import { TextEncoder, TextDecoder } from "./vendor/text-encoding.ts";\nglobalThis.TextEncoder = TextEncoder;\nself["TextDecoder"] = TextDecoder;\nObject.defineProperty(globalThis, "atob", { value: () => "" });',
		);
		expect(installs).toEqual(["TextEncoder", "TextDecoder", "atob"]);
	});

	it("is not a local of that name's member", () => {
		expect(
			moduleOf("const globalThis = {} as Record<string, unknown>;\nglobalThis.TextEncoder = 1;")
				.installs,
		).toEqual([]);
	});
});

describe("a thread's flag", () => {
	it("is read under any name it is imported by, or from a namespace", () => {
		expect(
			codesOf(
				'import { mainThread as onMain } from "@sohedra/lynx/env";\nif (onMain) { __FlushElementTree(); }',
			),
		).toEqual([]);
		expect(
			codesOf(
				'import * as env from "@sohedra/lynx/env";\nexport const f = () => env.mainThread && __FlushElementTree();',
			),
		).toEqual([]);
	});

	it("guards the code after an early return or throw", () => {
		expect(
			codesOf(
				'import { mainThread } from "@sohedra/lynx/env";\nexport function flush() { if (!mainThread) return; __FlushElementTree(); }',
			),
		).toEqual([]);
		expect(
			codesOf(
				'import { background } from "@sohedra/lynx/env";\nexport function flush() { if (background) { throw new Error("x"); } __FlushElementTree(); }',
			),
		).toEqual([]);
	});

	it("named so but declared by the script is no flag", () => {
		expect(
			codesOf(
				"const mainThread = true;\nexport const f = () => mainThread && __FlushElementTree();",
			),
		).toEqual(["main_thread_api_in_background"]);
	});
});

describe("top-level code", () => {
	it("runs on the main thread for the first frame: the background's API there is an error", () => {
		expect(codesOf("export const log = NativeModules.Log;")).toEqual([
			"background_api_on_main_thread",
		]);
		expect(
			codesOf(
				'import { background } from "@sohedra/lynx/env";\nexport const log = background ? NativeModules.Log : undefined;',
			),
		).toEqual([]);
		expect(
			codesOf(
				'import { mainThread } from "@sohedra/lynx/env";\nif (!mainThread) NativeModules.Log.write(1);',
			),
		).toEqual([]);
	});

	it("in a component's script and markup, outside {#if background}", async () => {
		const quiet =
			'<script>\n\timport { background } from "@sohedra/lynx/env";\n</script>\n{#if background}<text>{NativeModules.Info.name}</text>{/if}';
		await expect(component(quiet, { checks: true })).resolves.toBeDefined();
		const loud =
			"<script>\n\tconst info = NativeModules.Info;\n</script>\n<text>{info.name}</text>";
		await expect(component(loud, { checks: true })).rejects.toThrow(
			/background_api_on_main_thread/,
		);
	});
});

describe("the silencing comment in markup", () => {
	it("above a multi-line element silences its attributes", async () => {
		const source =
			'<!-- svelte-lynx-ignore dom_not_on_lynx -->\n<view\n\tclass="row"\n\tontap={() => document.title}\n></view>';
		await expect(component(source, { checks: true })).resolves.toBeDefined();
	});
});

describe("a fill package the app imports", () => {
	it.each([
		[
			"/app/node_modules/.pnpm/core-js@3.51.0/node_modules/core-js/modules/web.url.constructor.js",
			["URL"],
		],
		["/app/node_modules/core-js/modules/web.structured-clone.js", ["structuredClone"]],
		["/app/node_modules/fast-text-encoding/text.min.js", ["TextEncoder", "TextDecoder"]],
		[
			"/app/node_modules/abortcontroller-polyfill/dist/polyfill-patch-fetch.js",
			["AbortController", "AbortSignal"],
		],
		["/app/node_modules/whatwg-fetch/fetch.js", ["fetch", "Headers", "Request", "Response"]],
		["/app/node_modules/url-polyfill/url-polyfill.js", ["URL", "URLSearchParams"]],
	] as const)("installs what its file does: %s", (file, globals) => {
		expect(globalsInstalledBy(file)).toEqual(globals);
	});

	it("installs nothing from a ponyfill entry", () => {
		expect(globalsInstalledBy("/app/node_modules/web-streams-polyfill/dist/ponyfill.mjs")).toEqual(
			[],
		);
		expect(globalsInstalledBy("/app/node_modules/@ungap/structured-clone/esm/index.js")).toEqual(
			[],
		);
		expect(globalsInstalledBy("/app/node_modules/text-encoding/index.js")).toEqual([]);
		expect(
			globalsInstalledBy("C:\\app\\node_modules\\web-streams-polyfill\\dist\\polyfill.js"),
		).toContain("ReadableStream");
	});
});
