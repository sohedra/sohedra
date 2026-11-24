// A production build of a small app with `pluginSvelteLynx`: the output, the constants of each
// thread, `define`, `background-only`, the page config the encoder gets and the CSS in the
// template. One build serves every test in this file.

import fs from "node:fs";
import path from "node:path";

import { afterAll, beforeAll, describe, expect, it } from "@rstest/core";

import { buildApp, cleanBuild, readTemplate, scriptsOf } from "../build-app.ts";
import type { AppBuild } from "../build-app.ts";

let build: AppBuild;
let scripts: ReturnType<typeof scriptsOf>;
// oxlint-disable-next-line typescript/no-explicit-any -- the encoded template, read by key
let template: Record<string, any>;

beforeAll(async () => {
	build = await buildApp("app", {
		plugin: {
			define: {
				mainThread: { __API__: JSON.stringify("main-side") },
				background: { __API__: JSON.stringify("background-side") },
			},
			pageConfig: { longPressDuration: 400, tapSlop: "5px", enableCSSInheritance: true },
		},
	});
	if (build.ok) {
		scripts = scriptsOf(build);
		template = readTemplate(build);
	}
}, 180_000);
afterAll(() => cleanBuild(build));

describe("the output", () => {
	it("builds without a message", () => {
		expect(build.error + build.messages).toBe("");
		expect(build.ok).toBe(true);
	});

	it("is one bundle, with a script for each thread", () => {
		expect(fs.existsSync(path.join(build.dist, "out", "main.lynx.bundle"))).toBe(true);
		expect(scripts.mainThread.length).toBeGreaterThan(0);
		expect(scripts.background.length).toBeGreaterThan(0);
	});

	it("marks the main thread's script, which the template encodes as lepus code", () => {
		expect(template["lepusCode"]).toBeDefined();
	});
	it("points the code's own fetch at the global object's, where the fill puts it", () => {
		// The wrapper reads its `fetch` parameter itself, so the parameter keeps its name.
		expect(scripts.background).toContain("typeof globalThis.fetch");
		expect(scripts.background).not.toMatch(/typeof fetch\b/);
	});
});

describe("Lynx's dev client", () => {
	it("is in no thread's script of a production build, nor the binding's part of it", () => {
		for (const script of [scripts.background, scripts.mainThread]) {
			expect(script).not.toContain("the terminal shows all");
			expect(script).not.toContain("Errors while compiling");
		}
	});
});

describe("the constants of the threads", () => {
	it("gives the main thread __LEPUS__ true, __JS__ false and process.env.DEBUG", () => {
		expect(scripts.mainThread).toContain("lepus=true js=false");
		expect(scripts.mainThread).toContain("debug=lynx;");
	});

	it("gives the background thread __LEPUS__ false and __JS__ true", () => {
		expect(scripts.background).toContain("lepus=false js=true");
		expect(scripts.background).toContain("debug=lynx;");
	});
});

describe("define", () => {
	it("gives each thread its own value, and no thread the other's", () => {
		expect(scripts.mainThread).toContain("side=main-side");
		expect(scripts.mainThread).not.toContain("background-side");
		expect(scripts.background).toContain("side=background-side");
		expect(scripts.background).not.toContain("main-side");
	});
});

describe("background-only", () => {
	const markers = ["heavy-marker", "legacy-marker", "store-marker"];

	it("keeps the code of the modules that import it off the main thread, and on the background", () => {
		expect(markers.filter((marker) => scripts.mainThread.includes(marker))).toEqual([]);
		expect(markers.filter((marker) => scripts.background.includes(marker))).toEqual(markers);
	});

	it("leaves a stub for each: an ES module, a CommonJS module and a rune module", () => {
		expect(scripts.mainThread.match(/from the background-only module/g)).toHaveLength(3);
		expect(scripts.background).not.toContain("from the background-only module");
	});
});

describe("the page config", () => {
	it("encodes the keys it is given, whatever their type", () => {
		expect(template["sourceContent"].config).toMatchObject({
			longPressDuration: 400,
			tapSlop: "5px",
		});
	});

	it("takes the keys that have an option of the template plugin as that option does", () => {
		expect(template["sourceContent"].config["enableCSSInheritance"]).toBe(true);
	});

	it("encodes enableCSSInlineVariables by default, so that a `--x` in a style works", () => {
		expect(template["sourceContent"].config["enableCSSInlineVariables"]).toBe(true);
	});

	it("encodes enableFetchAPIStandardStreaming by default, so that a response's body streams", () => {
		expect(template["sourceContent"].config["enableFetchAPIStandardStreaming"]).toBe(true);
	});

	it("sets what the runtime needs, and what no setting turns off: the engine's newer paths", () => {
		expect(template["sourceContent"].config).toMatchObject({
			enableEventHandleRefactor: true,
			enableMicrotaskPromisePolyfill: true,
			enableA11y: true,
			enableNativeList: true,
			enableNewSticky: true,
			enableNewIntersectionObserver: true,
			enableNewGesture: true,
			enableAutoNonFlatten: true,
		});
		expect(template["compilerOptions"]).toMatchObject({
			enableFiberArch: true,
			enableCSSSelector: true,
		});
	});

	it("sets none of the keys that are legacy or no-ops at Lynx 4.2", () => {
		for (const key of ["enableEventRefactor", "enableTouchRefactor", "enableNewListContainer"]) {
			expect(template["sourceContent"].config).not.toHaveProperty(key);
			expect(template["compilerOptions"]).not.toHaveProperty(key);
		}
	});
});

describe("a component's styles", () => {
	it("are in the template, scoped by Svelte, and written with no :is()", () => {
		const selectors: string[] = template["css"].cssMap["0"].map(
			(rule: { selectorText: { value: string } }) => rule.selectorText.value,
		);
		expect(selectors.filter((selector) => selector.includes(":is("))).toEqual([]);
		const joined = selectors.join(",");
		expect(joined).toMatch(/\.page\.svelte-[a-z0-9]+ \.label\.svelte-[a-z0-9]+/);
		expect(joined).toMatch(/\.page\.svelte-[a-z0-9]+ \.caption\.svelte-[a-z0-9]+/);
	});

	it("are not in the main thread's script", () => {
		expect(scripts.mainThread).not.toContain("margin-top");
	});
});
