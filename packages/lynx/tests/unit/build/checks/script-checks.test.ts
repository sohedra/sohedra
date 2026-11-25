// The app's code that type-checks and then fails on Lynx is a build error at its place: a global the
// thread's engine lacks, the web's DOM, an API only the other thread has, and a plain function a
// main-thread function calls. A feature check keeps a read quiet, and so does the silencing comment.

import { describe, expect, it } from "@rstest/core";

import type { ModuleFills } from "../../../../src/build/checks/fills-store.ts";
import { checkModule } from "../../../../src/build/checks/module-checks.ts";
import { APP_ROOT, inApp } from "../app.ts";
import { component } from "../compiling.ts";

/** A plain module of the app, checked; its error's text, or its pending fills. */
function moduleOf(text: string, file = "util.ts"): ModuleFills {
	return checkModule({ file: inApp(file), text }, APP_ROOT);
}

/** The error a module's checks throw, as text, or "" when they throw none. */
function moduleError(text: string, file?: string): string {
	try {
		moduleOf(text, file);
		return "";
	} catch (error) {
		return (error as Error).message;
	}
}

/** The error a component's checks throw, as text, or "" when they throw none. */
async function componentError(source: string): Promise<string> {
	try {
		await component(source, { checks: true });
		return "";
	} catch (error) {
		return (error as Error).message;
	}
}

/** The codes in an error's text, in order. */
const codes = (text: string): string[] =>
	[...text.matchAll(/^https:\/\/sohedra\.com\/e\/(\w+)$/gm)].map((match) => match[1]!);

describe("a global no fill gives", () => {
	it("is an error at its place, with what to use instead", () => {
		const text = moduleError(
			'export const format = (n: number) => new Intl.NumberFormat("en").format(n);',
		);
		expect(text.split("\n")[0]).toBe(
			"Lynx's engine doesn't have the global `Intl`, and no fill gives it, so this code throws where it runs.",
		);
		expect(text).toContain("util.ts:1:42");
		expect(text).toContain("date-fns");
		expect(codes(text)).toEqual(["global_no_fill"]);
	});

	it("is quiet behind a feature check, in an if or in a ternary", () => {
		expect(
			moduleError(
				'export const f = () => typeof Intl !== "undefined" ? Intl.DateTimeFormat : null;',
			),
		).toBe("");
		expect(
			moduleError('if ("crypto" in globalThis) crypto.getRandomValues(new Uint8Array(1));'),
		).toBe("");
		expect(
			moduleError(
				"export const has = globalThis.WebSocket !== undefined;\nexport const make = () => new WebSocket('x');",
			),
		).toBe("");
	});

	it("is quiet where a local or an import of the same name shadows it", () => {
		expect(moduleError("const Intl = { x: 1 };\nexport const y = Intl.x;")).toBe("");
		expect(
			moduleError('import { crypto } from "./crypto.ts";\nexport const y = crypto.hash;'),
		).toBe("");
		expect(moduleError("export function f(crypto: { a: number }) { return crypto.a; }")).toBe("");
		expect(moduleError("try { f(); } catch (Intl) { console.log(Intl); }")).toBe("");
	});

	it("is not read in a type, a member's name or an object's key", () => {
		expect(
			moduleError(
				"export const o = { Intl: 1, crypto: 2 };\nexport const v = o.Intl;\nexport type T = Intl.NumberFormat;\nlet x: typeof crypto;",
			),
		).toBe("");
	});

	it("is silenced on its line by the comment", () => {
		expect(moduleError("// sohedra-ignore global_no_fill\nexport const c = crypto;")).toBe("");
		expect(moduleError("export const c = crypto; /* sohedra-ignore global_no_fill */")).toBe("");
		expect(
			codes(moduleError("// sohedra-ignore dom_not_on_lynx\nexport const c = crypto;")),
		).toEqual(["global_no_fill"]);
	});
});

describe("a global a fill gives", () => {
	it("waits on the app's imports, with the import that fills it", () => {
		const { pending } = moduleOf("export const bytes = new TextEncoder().encode('a');");
		expect(pending.map((fill) => fill.module)).toEqual(["@sohedra/lynx-polyfill/encoding"]);
		expect(pending[0]!.baseline).toBe(true);
		expect(pending[0]!.report.place?.where).toMatch(/util\.ts:1:26$/);
	});

	it("is filled by the module's own import of it or of the catch-all", () => {
		expect(
			moduleOf('import "@sohedra/lynx-polyfill/encoding";\nnew TextEncoder();').pending,
		).toEqual([]);
		expect(moduleOf('import "@sohedra/lynx-polyfill";\nnew TextEncoder();').pending).toEqual([]);
		expect(
			moduleOf('import "@sohedra/lynx-polyfill";\nnew URLPattern("/x");').pending.map(
				(fill) => fill.module,
			),
		).toEqual(["@sohedra/lynx-polyfill/url-pattern"]);
	});

	it("is left alone in a function where the background's engine has it, as lynx-core's URL", () => {
		expect(moduleOf("export const u = () => new URL('https://a.b');").pending).toEqual([]);
		expect(moduleOf("export const p = () => performance.now();").pending).toEqual([]);
	});

	it("at the top level, waits on its fill where the main thread lacks it, for the first frame", () => {
		const { pending } = moduleOf("export const u = new URL('https://a.b');");
		expect(pending.map((fill) => fill.report.details.lacks)).toEqual(["main thread"]);
		expect(pending[0]!.report.place?.where).toMatch(/util\.ts:1:22$/);
		const both = moduleOf("export const e = new TextEncoder();").pending;
		expect(both.map((fill) => fill.report.details.lacks)).toEqual(["engine"]);
	});

	it("at the top level, under a thread's flag, is judged on that thread only", () => {
		const text =
			'import { background } from "@sohedra/lynx/environment";\nexport const u = background ? new URL("https://a.b") : undefined;';
		expect(moduleOf(text).pending).toEqual([]);
	});

	it("in a main-thread function, waits on its fill where the main thread lacks it", () => {
		const { pending } = moduleOf(
			"export function f() {\n\t'main thread';\n\treturn new URL('https://a.b');\n}",
		);
		expect(pending.map((fill) => fill.module)).toEqual(["@sohedra/lynx-polyfill/url"]);
	});

	it("is quiet behind a feature check", () => {
		expect(
			moduleOf(
				"export const t = typeof TextEncoder === 'function' ? new TextEncoder() : undefined;",
			).pending,
		).toEqual([]);
	});
});

describe("the web's DOM", () => {
	it("is an error, with what to use instead", () => {
		const text = moduleError("export const el = document.querySelector('.a');");
		expect(text.split("\n")[0]).toBe(
			"`document` is part of the web's DOM, which Lynx doesn't have, so this code throws where it runs.",
		);
		expect(text).toContain("main-thread:ref");
		expect(codes(moduleError("export const w = window.innerWidth;"))).toEqual(["dom_not_on_lynx"]);
		expect(moduleError("export const w = window.innerWidth;")).toContain("systemInfo");
		expect(
			codes(moduleError("export const isDiv = (x: unknown) => x instanceof HTMLDivElement;")),
		).toEqual(["dom_not_on_lynx"]);
	});

	it("is quiet behind a feature check", () => {
		expect(
			moduleError("export const w = typeof window === 'undefined' ? 0 : window.innerWidth;"),
		).toBe("");
	});

	it("is an error in a component's script and markup", async () => {
		const text = await componentError(
			"<script>let w = $state(0);</script>\n<view ontap={() => (w = document.body.clientWidth)}></view>",
		);
		expect(codes(text)).toEqual(["dom_not_on_lynx"]);
		expect(text).toContain("Component.svelte:2:25");
	});

	it("is quiet for a name the markup declares, in an {#each} or a snippet", async () => {
		expect(
			await componentError(
				"{#each [1] as document, location}<text>{document}{location}</text>{/each}\n{#snippet row(window)}<text>{window}</text>{/snippet}",
			),
		).toBe("");
	});

	it("is silenced in markup by the comment", async () => {
		expect(
			await componentError(
				"<!-- sohedra-ignore dom_not_on_lynx -->\n<view ontap={() => document.title}></view>",
			),
		).toBe("");
	});

	it("is not checked in a package's own code", () => {
		expect(moduleError("export const el = document.body;", "../node_modules/lib/index.js")).toBe(
			"",
		);
	});
});

describe("an API of the other thread", () => {
	it("in a main-thread function, a background-only API is an error", () => {
		const text = moduleError(
			"export function onTap() {\n\t'main thread';\n\tNativeModules.bridge.call('x');\n\tlynx.getJSModule('GlobalEventEmitter');\n\tfetch('/x');\n}",
		);
		expect(codes(text)).toEqual([
			"background_api_on_main_thread",
			"background_api_on_main_thread",
			"background_api_on_main_thread",
		]);
		expect(text.split("\n")[0]).toBe(
			"A main-thread function uses `NativeModules`, which Lynx has on the background thread only.",
		);
		expect(text).toContain("`lynx.getJSModule`");
		expect(text).toContain("`fetch`");
	});

	it("in a main-thread function, a fill's global only the background gets is an error", () => {
		const text = moduleError(
			"export function f() {\n\t'main thread';\n\treturn new ReadableStream();\n}",
		);
		expect(codes(text)).toEqual(["background_api_on_main_thread"]);
		expect(text).toContain("`ReadableStream`");
	});

	it("outside a main-thread function, the background's API is fine", () => {
		expect(
			moduleError(
				"export const go = () => { NativeModules.bridge.call('x'); lynx.getJSModule('A'); fetch('/x'); };",
			),
		).toBe("");
	});

	it("in background code, an element function is an error", () => {
		const text = moduleError("export const make = () => __CreateView(0);");
		expect(codes(text)).toEqual(["main_thread_api_in_background"]);
		expect(text.split("\n")[0]).toBe(
			"`__CreateView` is used outside a main-thread function, and Lynx has it on the main thread only.",
		);
	});

	it("in a main-thread function, the main thread's API is fine", () => {
		expect(moduleError("export function f() {\n\t'main thread';\n\t__FlushElementTree();\n}")).toBe(
			"",
		);
	});

	it("lynx.querySelector is an error on either thread: Svelte on Lynx has it on neither", () => {
		const text = moduleError(
			"export function f() {\n\t'main thread';\n\tlynx.querySelector('.a');\n}\nexport const g = () => lynx.querySelectorAll('.b');",
		);
		expect(codes(text)).toEqual(["lynx_member_missing", "lynx_member_missing"]);
		expect(text.split("\n")[0]).toBe(
			"`lynx.querySelector` doesn't exist on either thread in Svelte on Lynx, so this code throws where it runs.",
		);
	});

	it("is left alone under a thread's flag, and the build's own constants are no API", () => {
		expect(moduleError("export const f = () => (__MAIN_THREAD__ ? __CreateView(0) : null);")).toBe(
			"",
		);
		expect(moduleError("if (__DEV__ && __BACKGROUND__) console.log(1);")).toBe("");
		expect(
			moduleError(
				'import { mainThread } from "@sohedra/lynx/environment";\nif (mainThread) __FlushElementTree();',
			),
		).toBe("");
	});

	it("is quiet for a lynx member the code checks for first", () => {
		expect(
			moduleError(
				"export function f() {\n\t'main thread';\n\tif (typeof lynx.getJSModule === 'function') lynx.getJSModule('A');\n}",
			),
		).toBe("");
	});

	it("in a component's markup, a main-thread handler's background-only call is an error", async () => {
		const text = await componentError(
			"<view main-thread:ontap={() => { 'main thread'; NativeModules.x.y(); }}></view>",
		);
		expect(codes(text)).toEqual(["background_api_on_main_thread"]);
	});
});

describe("a plain function a main-thread function calls", () => {
	it("is an error where it is called, when the file declares it", () => {
		const text = moduleError(
			"function save(value: number) { return value; }\nexport function onTap() {\n\t'main thread';\n\tsave(1);\n}",
		);
		expect(codes(text)).toEqual(["plain_function_in_main_thread_function"]);
		expect(text).toContain("util.ts:4:2");
		expect(text).toContain("runOnBackground(save)");
	});

	it("is fine through runOnBackground, as a main-thread function, or declared inside", () => {
		expect(
			moduleError(
				"import { runOnBackground } from '@sohedra/lynx';\nconst save = () => 1;\nconst clamp = (x: number) => { 'main thread'; return x; };\nexport function onTap() {\n\t'main thread';\n\trunOnBackground(save)();\n\tclamp(1);\n\tconst local = () => 2;\n\tlocal();\n}",
			),
		).toBe("");
	});

	it("is left to the run-time check when it is imported", () => {
		expect(
			moduleError(
				"import { save } from './save.ts';\nexport function onTap() {\n\t'main thread';\n\tsave();\n}",
			),
		).toBe("");
	});
});

describe("a component's errors", () => {
	it("come together, the first one's sentence first", async () => {
		const text = await componentError(
			"<script>\n\tconst a = crypto;\n\tconst b = document;\n</script>",
		);
		expect(codes(text)).toEqual(["global_no_fill", "dom_not_on_lynx"]);
	});

	it("are not looked for without checks, as in a package or a test run", async () => {
		const compiled = await component("<script>const a = document;</script>");
		expect(compiled.fills).toEqual({ pending: [], imports: [], installs: [] });
	});

	it("give the reads that wait on a fill, and the fills the component imports", async () => {
		const compiled = await component(
			'<script>\n\timport "@sohedra/lynx-polyfill/url";\n\tconst t = new TextEncoder();\n</script>',
			{ checks: true },
		);
		expect(compiled.fills.imports).toEqual(["@sohedra/lynx-polyfill/url"]);
		expect(compiled.fills.pending.map((fill) => fill.report.details.name)).toEqual(["TextEncoder"]);
	});

	it("are only the background copy's", async () => {
		const compiled = await component("<script>const a = document;</script>", {
			checks: true,
			thread: "main-thread",
		});
		expect(compiled.code).toContain("document");
	});
});

describe("Svelte's own mount, unmount and hydrate", () => {
	it("are an error at their import, which names the binding's", () => {
		const text = moduleError('import { mount, tick } from "svelte";\nexport { mount, tick };');
		expect(text.split("\n")[0]).toBe(
			"`mount` is imported from \"svelte\", whose `mount` works with the web's DOM, not with Lynx's page.",
		);
		expect(text).toContain("util.ts:1:10");
		expect(text).toContain(
			'Import `mount` from "@sohedra/lynx", which mounts a component on the page.',
		);
		expect(codes(text)).toEqual(["svelte_mount_imported"]);
	});

	it("are an error in a component, under any local name", async () => {
		const text = await componentError(
			'<script>\n\timport { unmount as remove } from "svelte";\n\tremove({});\n</script>',
		);
		expect(codes(text)).toEqual(["svelte_mount_imported"]);
		expect(text.split("\n")[0]).toContain("`unmount`");
	});

	it("are an error through a namespace import, and re-exported", () => {
		const read = moduleError('import * as svelte from "svelte";\nexport const m = svelte.mount;');
		expect(codes(read)).toEqual(["svelte_mount_imported"]);
		expect(read).toContain("util.ts:2:18");
		expect(codes(moduleError('import * as s from "svelte";\ns["unmount"]({});'))).toEqual([
			"svelte_mount_imported",
		]);
		expect(codes(moduleError('export { tick, mount } from "svelte";'))).toEqual([
			"svelte_mount_imported",
		]);
		expect(moduleError('import * as svelte from "svelte";\nexport const t = svelte.tick;')).toBe(
			"",
		);
	});

	it("are an error for hydrate, in every form, whose fix is the binding's mount", () => {
		const text = moduleError('import { hydrate } from "svelte";\nvoid hydrate;');
		expect(text.split("\n")[0]).toBe(
			"`hydrate` is imported from \"svelte\", whose `hydrate` works with the web's DOM, not with Lynx's page.",
		);
		expect(text).toContain("util.ts:1:10");
		expect(text).toContain(
			'Use `mount` from "@sohedra/lynx": the binding hydrates the first frame itself.',
		);
		expect(codes(text)).toEqual(["svelte_mount_imported"]);
		expect(codes(moduleError('export { hydrate } from "svelte";'))).toEqual([
			"svelte_mount_imported",
		]);
		expect(
			codes(moduleError('import * as svelte from "svelte";\nexport const h = svelte.hydrate;')),
		).toEqual(["svelte_mount_imported"]);
		expect(
			moduleError('import type { hydrate } from "svelte";\nexport type H = typeof hydrate;'),
		).toBe("");
	});

	it("leave the binding's, a type import and the silencing comment alone", () => {
		expect(
			moduleError('import { mount, unmount } from "@sohedra/lynx";\nvoid [mount, unmount];'),
		).toBe("");
		expect(moduleError('import type { mount } from "svelte";\nexport type M = typeof mount;')).toBe(
			"",
		);
		expect(
			moduleError(
				'import { type mount, tick } from "svelte";\nexport type M = typeof mount;\nvoid tick;',
			),
		).toBe("");
		expect(moduleError('export type { mount } from "svelte";')).toBe("");
		expect(
			moduleError(
				'// sohedra-ignore svelte_mount_imported\nimport {\n\ttick,\n\tmount,\n} from "svelte";\nvoid [tick, mount];',
			),
		).toBe("");
		expect(
			moduleError(
				'// sohedra-ignore svelte_mount_imported\nimport { mount } from "svelte";\nvoid mount;',
			),
		).toBe("");
	});
});
