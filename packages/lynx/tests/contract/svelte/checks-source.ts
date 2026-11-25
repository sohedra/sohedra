// Rows that rest on the text of a file of the Svelte package.

import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

import { expect } from "@rstest/core";

import type { Checks } from "./check.ts";
import { SVELTE_ROOT, occurrences, readSvelte } from "./svelte-package.ts";

/** The names Svelte's own `VOID_ELEMENT_NAMES` holds (the first frame's parser ends them at their opening tag). */
const VOID_ELEMENTS = [
	"area",
	"base",
	"br",
	"col",
	"command",
	"embed",
	"hr",
	"img",
	"input",
	"keygen",
	"link",
	"meta",
	"param",
	"source",
	"track",
	"wbr",
];

/** What `svelte/reactivity/window` exports; Lynx has a window's size, and nothing of the rest. */
const WINDOW_VALUES = [
	"scrollX",
	"scrollY",
	"innerWidth",
	"innerHeight",
	"outerWidth",
	"outerHeight",
	"screenLeft",
	"screenTop",
	"online",
	"devicePixelRatio",
];

const byName = (a: string, b: string): number => a.localeCompare(b);

/** The files of Svelte's source under `folder`, relative to the package, that contain `text`. */
function filesWith(folder: string, text: string): string[] {
	const found: string[] = [];
	const walk = (relative: string): void => {
		for (const entry of fs.readdirSync(path.join(SVELTE_ROOT, relative), { withFileTypes: true })) {
			const child = path.posix.join(relative, entry.name);
			if (entry.isDirectory()) walk(child);
			else if (entry.name.endsWith(".js") && readSvelte(child).includes(text)) found.push(child);
		}
	};
	walk(folder);
	return found.sort();
}

export const checks: Checks = {
	"renderer-cleared-by-async-context": () => {
		// A new place that clears the current renderer is one more place `on()` must not depend on.
		expect(filesWith("src", "set_renderer(null)")).toEqual([
			"src/internal/client/reactivity/async.js",
		]);
		expect(filesWith("src", "unset_context")).toEqual([
			"src/internal/client/dom/blocks/await.js",
			"src/internal/client/reactivity/async.js",
			"src/internal/client/reactivity/deriveds.js",
		]);
	},

	"dev-error-component-lines": () => {
		const handling = readSvelte("src/internal/client/error-handling.js");
		// A development build adds a line per component under the message of an error that leaves an
		// effect, the innermost first, after a line for the effect: `\n\tin $effect\n\tin Card.svelte`.
		expect(handling).toMatch(
			/var component_stack = `\\n\$\{indent\}in \$\{effect\.fn\?\.name \|\| '<unknown>'\}`;/,
		);
		expect(handling).toMatch(
			/component_stack \+= `\\n\$\{indent\}in \$\{context\.function\?\.\[FILENAME\]\.split\('\/'\)\.pop\(\)\}`;/,
		);
		expect(handling).toContain("var indent = is_firefox ? '  ' : '\\t';");
		expect(handling).toMatch(/message: error\.message \+ `\\n\$\{component_stack\}\\n`,/);
	},

	"spread-props-setter-anchors": () => {
		const props = readSvelte("src/internal/client/reactivity/props.js");
		// The two lines the build patches: each must be there exactly once.
		expect(occurrences(props, "return new Proxy({ props }, spread_props_handler);")).toBe(1);
		expect(occurrences(props, "get_descriptor(props, key)?.set ??")).toBe(1);
		// The patch's code uses what the file imports.
		expect(props).toMatch(
			/import \{ get_descriptor, is_function \} from '..\/..\/shared\/utils.js';/,
		);
		// And finds a setter the way the Proxy's own `set` does: from the last props to the first.
		expect(props).toMatch(
			/set\(target, key, value\) \{\n\t\tlet i = target\.props\.length;\n\t\twhile \(i--\) \{\n\t\t\tlet p = target\.props\[i\];\n\t\t\tif \(is_function\(p\)\) p = p\(\);\n\t\t\tconst desc = get_descriptor\(p, key\);\n\t\t\tif \(desc && desc\.set\) \{/,
		);
	},

	"valid-tag-name-regex": () => {
		const utils = readSvelte("src/utils.js");
		// A `/u` regex with an astral escape, which Lynx's main-thread engine cannot compile.
		expect(utils).toMatch(
			/REGEX_VALID_TAG_NAME\s*=\s*\/\^\[a-zA-Z\][\s\S]*?\\u\{10000\}[\s\S]*?\/u;/,
		);
	},

	"invalid-attribute-name-regex": () => {
		const server = readSvelte("src/internal/server/index.js");
		expect(server).toMatch(/INVALID_ATTR_NAME_CHAR_REGEX\s*=\s*\/\[[\s\S]*?\\u\{10FFFF\}\]\/u;/);
	},

	"attribute-functions-only-as-events": () => {
		const attributes = readSvelte("src/internal/client/dom/elements/attributes.js");
		// A spread passes a function on only under an `on…` name, and drops any other.
		expect(attributes).toContain("} else if (typeof value !== 'function') {");
	},

	"void-element-names": () => {
		const list = /const VOID_ELEMENT_NAMES = \[([^\]]*)\]/.exec(readSvelte("src/utils.js"))?.[1];
		expect(list).toBeDefined();
		const names = [...(list ?? "").matchAll(/'([^']+)'/g)].map((match) => String(match[1]));
		expect(names.toSorted(byName)).toEqual(VOID_ELEMENTS.toSorted(byName));
	},

	"server-block-markers": () => {
		const ifBlock = readSvelte("src/compiler/phases/3-transform/server/visitors/IfBlock.js");
		expect(ifBlock).toContain("prepend_block_marker(consequent, `<!--[0-->`);");
		expect(ifBlock).toMatch(/prepend_block_marker\(branch, `<!--\[\$\{index\+\+\}-->`\);/);
		expect(ifBlock).toContain("prepend_block_marker(final_alternate, `<!--[-1-->`);");
		const markers = readSvelte("src/internal/server/hydration.js");
		expect(markers).toMatch(/export const BLOCK_OPEN = `<!--\$\{HYDRATION_START\}-->`;/);
		expect(markers).toMatch(/export const BLOCK_CLOSE = `<!--\$\{HYDRATION_END\}-->`;/);
		const constants = readSvelte("src/constants.js");
		expect(constants).toContain("export const HYDRATION_START = '[';");
		expect(constants).toContain("export const HYDRATION_END = ']';");
	},

	"props-id-order": () => {
		expect(readSvelte("src/internal/server/renderer.js")).toMatch(
			/this\.uid = \(\) => `\$\{id_prefix\}s\$\{uid\+\+\}`;/,
		);
		expect(readSvelte("src/internal/server/index.js")).toMatch(
			/export function props_id\(renderer\) \{\n\tconst uid = renderer\.global\.uid\(\);/,
		);
		expect(readSvelte("src/internal/client/index.js")).toContain("props_id,");
		// The server's prefix is `render`'s `idPrefix` and a dash; the client's count is on the global.
		expect(readSvelte("src/internal/server/renderer.js")).toContain(
			"options.idPrefix ? options.idPrefix + '-' : ''",
		);
		expect(readSvelte("src/internal/client/dom/template.js")).toContain(
			"(globalThis.__svelte ??= {}).uid ??= 1;",
		);
	},

	"server-render-global": () => {
		const renderer = readSvelte("src/internal/server/renderer.js");
		// A render makes one state, and every renderer it makes shares it.
		expect(renderer).toMatch(/return new Renderer\(\n\t+new SSRState\(/);
		expect(occurrences(renderer, "new Renderer(this.global, this)")).toBeGreaterThan(2);
		expect(renderer).not.toMatch(/new Renderer\(new SSRState/);
		expect(readSvelte("src/internal/server/index.js")).toMatch(
			/export function props_id\(renderer\) \{\n\tconst uid = renderer\.global\.uid\(\);/,
		);
	},

	"spring-source": () => {
		const spring = readSvelte("src/motion/spring.js");
		expect(spring).toMatch(/export class Spring/);
		expect(spring).toMatch(/export function spring/);
		// It reads no window when it loads (the module around it does).
		expect(spring).not.toMatch(/MediaQuery|matchMedia/);
	},

	"tween-source": () => {
		const tweened = readSvelte("src/motion/tweened.js");
		expect(tweened).toMatch(/export class Tween/);
		expect(tweened).toMatch(/export function tweened/);
		expect(tweened).not.toMatch(/MediaQuery|matchMedia/);
	},

	"motion-index-media-query": () => {
		const index = readSvelte("src/motion/index.js");
		expect(index).toContain("import { MediaQuery } from 'svelte/reactivity';");
		// Made when the module loads, and `matchMedia` is not on Lynx.
		expect(index).toContain("export const prefersReducedMotion = /*@__PURE__*/ new MediaQuery(");
	},

	"window-values": () => {
		const window = readSvelte("src/reactivity/window/index.js");
		for (const name of WINDOW_VALUES) expect(window).toContain(`export const ${name} =`);
		// They read `window` and listen to it when they are created.
		expect(window).toContain("on(window, 'scroll', update)");
	},

	"url-class-extends-global": () => {
		expect(readSvelte("src/reactivity/url.js")).toContain("export class SvelteURL extends URL {");
	},

	"url-search-params-class-extends-global": () => {
		expect(readSvelte("src/reactivity/url-search-params.js")).toContain(
			"export class SvelteURLSearchParams extends URLSearchParams {",
		);
	},

	"package-declares-no-side-effects": () => {
		// Without the field, a bundler keeps the two classes above for a page that never uses them.
		// Boundary: JSON has no type.
		const manifest = JSON.parse(readSvelte("package.json")) as { sideEffects?: unknown };
		expect(manifest.sideEffects).toBeUndefined();
	},

	"dom-url-in-src-url-equal": () => {
		// The one place the DOM code names `URL`, in a function a custom renderer never gets to.
		expect(readSvelte("src/internal/client/dom/elements/attributes.js")).toMatch(
			/function src_url_equal\(element_src, url\) \{\n\tif \(element_src === url \|\| current_renderer != null\) return true;\n\treturn new URL\(/,
		);
	},

	"urls-named-in-three-files": () => {
		// Which of Svelte's own files name a free `URL` or `URLSearchParams`, outside comments.
		const found: string[] = [];
		const walk = (folder: string): void => {
			for (const entry of fs.readdirSync(path.join(SVELTE_ROOT, "src", folder), {
				withFileTypes: true,
			})) {
				const file = `${folder}/${entry.name}`;
				if (entry.isDirectory()) walk(file);
				else if (entry.name.endsWith(".js")) {
					const code = readSvelte(`src/${file}`)
						.replace(/\/\*[\s\S]*?\*\//g, "")
						.replace(/\/\/.*$/gm, "");
					if (/(?<![.\w'"`])(?:URL|URLSearchParams)\b/.test(code)) found.push(file);
				}
			}
		};
		for (const folder of ["internal/client", "internal/shared", "reactivity"]) walk(folder);
		expect(found.toSorted(byName)).toEqual([
			"internal/client/dom/elements/attributes.js",
			"reactivity/url-search-params.js",
			"reactivity/url.js",
		]);
	},

	"server-reactivity-reads-globals": () => {
		const server = readSvelte("src/reactivity/index-server.js");
		expect(server).toContain("export const SvelteURL = globalThis.URL;");
		expect(server).toContain("export const SvelteURLSearchParams = globalThis.URLSearchParams;");
		expect(server).toContain("export class MediaQuery {");
		expect(server).toContain("export function createSubscriber(");
	},

	"async-hooks-import": () => {
		// Only async server rendering loads it, by a dynamic import.
		expect(readSvelte("src/internal/server/render-context.js")).toContain(
			"import('node:async_hooks')",
		);
	},

	"crypto-import": () => {
		const crypto = readSvelte("src/internal/server/crypto.js");
		expect(crypto).toContain(
			"const obfuscated_import = (module_name) => import(/* @vite-ignore */ module_name);",
		);
	},

	"devalue-for-hydratable": () => {
		// Two modules of the server runtime import `devalue`, and call its `uneval` alone.
		const importers = filesWith("src", "from 'devalue'").sort(byName);
		expect(importers).toEqual([
			"src/internal/server/hydratable.js",
			"src/internal/server/renderer.js",
		]);
		for (const file of importers) {
			const source = readSvelte(file);
			expect(source).toContain("import * as devalue from 'devalue';");
			expect(new Set(source.match(/\bdevalue\.\w+/g))).toEqual(new Set(["devalue.uneval"]));
		}
		// `hydratable` asks for async rendering's context before it serializes, and a synchronous
		// render has none: it throws first.
		const hydratable = readSvelte("src/internal/server/hydratable.js");
		expect(hydratable.indexOf("get_render_context()")).toBeGreaterThan(-1);
		expect(hydratable.indexOf("get_render_context()")).toBeLessThan(
			hydratable.indexOf("encode(key, value"),
		);
		// The renderer serializes only in its hydratable block, which async rendering alone writes.
		const renderer = readSvelte("src/internal/server/renderer.js");
		expect(occurrences(renderer, "devalue.uneval(")).toBe(1);
		expect(occurrences(renderer, "this.#hydratable_block(")).toBe(1);
		expect(renderer).toContain("return await this.#hydratable_block(ctx);");
	},

	"runtime-reads-event-target": () => {
		// Where the binding's global `EventTarget` is read: copying state, and walking an action's value.
		expect(filesWith("src", "instanceof EventTarget")).toEqual([
			"src/internal/client/runtime.js",
			"src/internal/shared/clone.js",
		]);
		// Unguarded: once Svelte checks for the global first, the fills can go.
		for (const file of ["src/internal/client/runtime.js", "src/internal/shared/clone.js"])
			expect(readSvelte(file)).not.toMatch(/typeof (globalThis\.)?EventTarget\b/);
	},

	"runtime-reads-structured-clone": () => {
		// Where the binding's global `structuredClone` is called: a `Date`, and every other leaf.
		expect(filesWith("src", "structuredClone(")).toEqual(["src/internal/shared/clone.js"]);
		expect(occurrences(readSvelte("src/internal/shared/clone.js"), "structuredClone(value)")).toBe(
			2,
		);
		// Unguarded: once Svelte checks for the global first, the fills can go.
		for (const file of ["src/internal/client/runtime.js", "src/internal/shared/clone.js"])
			expect(readSvelte(file)).not.toMatch(/typeof (globalThis\.)?structuredClone\b/);
	},

	"disclose-version-window-guard": () => {
		// Every component imports it, on a thread with no window.
		expect(readSvelte("src/internal/disclose-version.js")).toContain(
			"if (typeof window !== 'undefined') {",
		);
	},

	"svelte-own-dependencies": () => {
		// Boundary: JSON has no type.
		const manifest = JSON.parse(readSvelte("package.json")) as {
			dependencies: Record<string, string>;
		};
		for (const name of ["acorn", "@sveltejs/acorn-typescript", "esm-env"]) {
			expect(Object.keys(manifest.dependencies)).toContain(name);
		}
		// The binding reads them from Svelte's own copy, so no app installs them.
		const fromSvelte = createRequire(path.join(SVELTE_ROOT, "package.json"));
		// Boundary: Svelte's own dependencies are loaded by name and have no types here.
		const acorn = fromSvelte("acorn") as { Parser: { extend: unknown } };
		const typescript = fromSvelte("@sveltejs/acorn-typescript") as { tsPlugin: unknown };
		expect(typeof acorn.Parser.extend).toBe("function");
		expect(typeof typescript.tsPlugin).toBe("function");
	},
};
