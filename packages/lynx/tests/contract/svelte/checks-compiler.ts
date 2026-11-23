// Rows that rest on what Svelte's compiler accepts, rejects, reads and writes.

import { expect } from "@rstest/core";
import { compile, parse } from "svelte/compiler";
import type { AST } from "svelte/compiler";

import { CSS_PROPS_HOLDERS } from "../../../src/svelte/runtime/index.ts";
import type { Checks } from "./check.ts";
import { clientOptions, compileClient, compileServer } from "./compile.ts";
import { importSvelte, readSvelte } from "./svelte-package.ts";

/** The compile error `run` throws, or `undefined` when it does not throw. */
function thrown(run: () => unknown): (Error & { code?: string }) | undefined {
	try {
		run();
	} catch (error) {
		// Boundary: a thrown value is `unknown`; Svelte's compile errors carry a `code`.
		return error as Error & { code?: string };
	}
	return undefined;
}

/** Every feature Svelte refuses under a custom renderer, how it is written, and how Svelte names it. */
const BANNED = [
	["`bind:`", "<view bind:this={el}></view>"],
	["`bind:`", "<input bind:value={x} />"],
	["`transition:`", "<view transition:fn></view>"],
	["`in:`", "<view in:fn></view>"],
	["`out:`", "<view out:fn></view>"],
	["`animate:`", "{#each [1] as i (i)}<view animate:fn></view>{/each}"],
	["`@html`", '<view>{@html "x"}</view>'],
	["`on:`", "<view on:tap={fn}></view>"],
	["`<svelte:window>`", "<svelte:window />"],
	["`<svelte:document>`", "<svelte:document />"],
	["`<svelte:body>`", "<svelte:body />"],
	["`<svelte:head>`", "<svelte:head></svelte:head>"],
	["`css: 'injected'`", '<svelte:options css="injected" /><view></view>'],
] as const;

/** What the binding gives its users that the compiler must keep accepting. */
const SUPPORTED = [
	["{@attach}", "<view {@attach fn}></view>"],
	["use:", "<view use:fn></view>"],
	["class:", "<view class:on={x}></view>"],
	["style:", "<view style:opacity={x}></view>"],
	["a spread", '<view {...{ id: "a" }}></view>'],
	["<svelte:element>", '<svelte:element this={"view"}></svelte:element>'],
	["{#await}", "{#await Promise.resolve(1) then v}<text>{v}</text>{/await}"],
	["{#key}", "{#key x}<view></view>{/key}"],
	["<svelte:boundary onerror>", "<svelte:boundary onerror={fn}><view></view></svelte:boundary>"],
	[
		"<svelte:boundary> with a failed snippet",
		"<svelte:boundary><view></view>{#snippet failed(e)}<text>err</text>{/snippet}</svelte:boundary>",
	],
	[
		"<svelte:boundary> with a pending snippet",
		"<svelte:boundary>{#snippet pending()}<text>wait</text>{/snippet}<view></view></svelte:boundary>",
	],
] as const;

/** Where the build puts a deferred row's `{@const}`, by the node and field that hold it. */
const CONST_PLACES = [
	["EachBlock", "body", "{#each xs as x}{@const r = 1}<view></view>{/each}"],
	[
		"EachBlock",
		"fallback",
		"{#each xs as x}<view></view>{:else}{@const r = 1}<view></view>{/each}",
	],
	["IfBlock", "consequent", "{#if x}{@const r = 1}<view></view>{/if}"],
	["IfBlock", "alternate", "{#if x}<view></view>{:else}{@const r = 1}<view></view>{/if}"],
	["KeyBlock", "fragment", "{#key x}{@const r = 1}<view></view>{/key}"],
	["AwaitBlock", "pending", "{#await x}{@const r = 1}<view></view>{/await}"],
	["AwaitBlock", "then", "{#await x then v}{@const r = 1}<view></view>{/await}"],
	["AwaitBlock", "catch", "{#await x catch e}{@const r = 1}<view></view>{/await}"],
	["SnippetBlock", "body", "{#snippet s()}{@const r = 1}<view></view>{/snippet}"],
	["Component", "fragment", "<Child>{@const r = 1}<view></view></Child>"],
	["SvelteBoundary", "fragment", "<svelte:boundary>{@const r = 1}<view></view></svelte:boundary>"],
] as const;

export const checks: Checks = {
	"const-tag-places": () => {
		for (const [type, field, source] of CONST_PLACES) {
			const code = `<script>import Child from "./Child.svelte"; let { x, xs } = $props();</script>${source}`;
			expect(
				thrown(() => compile(code, clientOptions())),
				source,
			).toBeUndefined();
			const ast = parse(code, { modern: true, filename: "Places.svelte" });
			const node = ast.fragment.nodes.find((child) => child.type === type);
			// Boundary: the field is read by name, as the build reads it.
			const fragment = (node as unknown as Record<string, AST.Fragment>)[field];
			expect(
				fragment?.nodes.some((child) => child.type === "ConstTag"),
				source,
			).toBe(true);
		}
		expect(
			thrown(() => compileClient("<list>{@const r = 1}<list-item></list-item></list>"))?.code,
		).toBe("const_tag_invalid_placement");
	},
	"css-props-holder": () => {
		// A component given `--x` props is wrapped in an element that holds them, by one of two tags,
		// and placed at its last child, which Svelte reads through the renderer.
		for (const markup of ['<view><el.C --tone="1" /></view>', '<el.C --tone="1" />']) {
			const code = compileClient(markup);
			const tag = /\['(g|svelte-css-wrapper)', /.exec(code)?.[1];
			expect(tag, markup).toBeDefined();
			expect(CSS_PROPS_HOLDERS.has(tag!), markup).toBe(true);
			expect(code).toMatch(/\$\.css_props\((\w+), [^]*\$\.component\(\$\.get_last_child\(\1\),/);
		}
		expect(new Set(CSS_PROPS_HOLDERS)).toEqual(new Set(["g", "svelte-css-wrapper"]));
	},

	"custom-renderer-compile-options": () => {
		// The three options the binding sets on every background component.
		expect(thrown(() => compileClient("<view></view>"))).toBeUndefined();
		const code = compileClient("<view></view>");
		expect(code).toMatch(/\$\.from_tree\(/);
		// The renderer is named by its package's specifier: a relative path is refused, since every
		// component would resolve it from its own folder.
		const relative = thrown(() =>
			compileClient("<view></view>", { customRenderer: "./renderer.js" }),
		);
		expect(relative?.code).toBe("options_invalid_value");
	},

	"custom-renderer-flag-import": () => {
		// Every component imports the module that turns Svelte's renderer code on as it loads.
		expect(compileClient("<view></view>")).toContain(
			"import 'svelte/internal/flags/custom-renderer';",
		);
		// Boundary: Svelte's package.json, read as JSON.
		const { exports } = JSON.parse(readSvelte("package.json")) as {
			exports: Record<string, Record<string, string>>;
		};
		const flag = exports["./internal/flags/custom-renderer"]!;
		expect(flag["browser"]).toBe(flag["svelte-custom-renderer"]);
		expect(flag["default"]).not.toBe(flag["browser"]);
		expect(readSvelte(flag["browser"]!)).toContain("enable_custom_renderers_flag();");
	},

	"hot-reload-footer": () => {
		const { js } = compile("<script>let x = 1;</script><view>{x}</view>", {
			...clientOptions(),
			filename: "Hot.svelte",
			dev: true,
			hmr: true,
		});
		// The exact shape the build rewrites for a bundler that is not Vite.
		expect(js.code).toMatch(
			/if \(import\.meta\.hot\) \{\s*(\w+) = \$\.hmr\(\1\);\s*import\.meta\.hot\.accept\(\(module\) => \{\s*(?:\$\.cleanup_styles\([^)]*\);\s*)?\1\[\$\.HMR\]\.update\(module\.default\);\s*\}\);\s*\}/,
		);
	},

	"component-export-shape": () => {
		// The first frame's twin of a component hangs on the function's name.
		expect(compileClient("<view></view>")).toMatch(/^export default function Contract\(/m);
		expect(
			compile("<view></view>", { ...clientOptions(), filename: "Name.svelte", name: "Name_1" }).js
				.code,
		).toMatch(/^export default function Name_1\(/m);
	},

	"internal-import-specifiers": () => {
		// The build points both at its own module; it finds them as strings.
		expect(compileClient("<view></view>")).toMatch(/from 'svelte\/internal\/client'/);
		expect(compileServer("<view></view>")).toMatch(/from 'svelte\/internal\/server'/);
	},

	"no-init-operations": () => {
		// That module reaches for the DOM when it loads.
		expect(compileClient("<view></view>")).not.toContain("init-operations");
	},

	"attribute-effect-spread": async () => {
		const code = compileClient("<view {...{ bindtap: fn }}></view>");
		expect(code).toMatch(/\$\.attribute_effect\(view, \(\) => \(/);
		const internal = await importSvelte("src/internal/client/index.js");
		expect(typeof internal["attribute_effect"]).toBe("function");
	},

	"server-drops-handlers-and-effects": () => {
		// The first frame cannot see an element's handlers or an effect's body.
		const handler = compileServer("<view ontap={fn} onscrollmarker={fn}></view>");
		expect(handler).not.toContain("ontap");
		expect(handler).not.toContain("onscrollmarker");
		const effect = compile(
			'<script>$effect(() => { console.log("effect-body-marker"); });</script><view></view>',
			{ generate: "server", runes: true, filename: "Effect.svelte" },
		).js.code;
		expect(effect).not.toContain("effect-body-marker");
	},

	"template-node-shapes": () => {
		const ast = parse(
			'<svelte:options customRenderer={null} /><script>$effect(() => { import("./Lazy.svelte"); });</script>' +
				"<view muted ontap={() => {}}></view>{#if true}{@const y = 1}<text>{y}</text>{/if}" +
				"<svelte:boundary><view></view></svelte:boundary>",
			{ modern: true, filename: "Shapes.svelte" },
		);
		const [element, block, boundary] = ast.fragment.nodes.filter((node) => node.type !== "Text");
		expect(element?.type).toBe("RegularElement");
		// Narrowing: the fixture's first node is an element with plain attributes, not directives.
		const attributes = (element as AST.RegularElement).attributes as AST.Attribute[];
		// A bare attribute is `true`; a handler is one expression.
		expect(attributes[0]).toMatchObject({ type: "Attribute", name: "muted", value: true });
		expect(attributes[1]?.value).toMatchObject({ type: "ExpressionTag" });
		// Narrowing: the fixture's second node is an `{#if}` block.
		expect((block as AST.IfBlock).consequent.nodes.some((node) => node.type === "ConstTag")).toBe(
			true,
		);
		expect(boundary?.type).toBe("SvelteBoundary");
		// `<svelte:options customRenderer={null}>`: a literal null.
		expect(ast.options?.attributes[0]).toMatchObject({
			type: "Attribute",
			name: "customRenderer",
			value: { type: "ExpressionTag", expression: { type: "Literal", value: null } },
		});
		// An `$effect`'s `import()`.
		const program = ast.instance?.content;
		expect(JSON.stringify(program)).toMatch(/"type":"ImportExpression"/);
		// A script's program has positions in the whole component, which the build edits by.
		const text = "<view></view>\n<script>let a = 1;</script>";
		const located = parse(text, { modern: true, filename: "Positions.svelte" });
		const content = located.instance?.content as unknown as { start: number; end: number };
		expect(text.slice(content.start, content.end)).toBe("let a = 1;");
		// A component without a script has none, and a module script is its own.
		expect(parse("<view></view>", { modern: true }).instance ?? null).toBeNull();
		expect(
			parse("<script module>export const a = 1;</script>", { modern: true }).module,
		).toBeTruthy();
		// A keyed `{#each}` holds its key as an expression with positions, and its body's nodes.
		const keyedText =
			"<script>let rows = [1];</script>{#each rows as row (row.id)}<list-item>{row}</list-item>{/each}" +
			"<view {ontap} {...rest}></view>";
		const keyed = parse(keyedText, { modern: true, filename: "Keyed.svelte" });
		const [each, host] = keyed.fragment.nodes.filter((node) => node.type !== "Text");
		// Narrowing: the fixture's first node is the `{#each}` block.
		const eachBlock = each as AST.EachBlock;
		// Boundary: Svelte types its expressions without the positions it gives them.
		const key = eachBlock.key as unknown as { start: number; end: number };
		expect(keyedText.slice(key.start, key.end)).toBe("row.id");
		expect(eachBlock.body.nodes[0]).toMatchObject({ type: "RegularElement", name: "list-item" });
		// Narrowing: the fixture's second node is an element with a shorthand and a spread.
		const [shorthand, spread] = (host as AST.RegularElement).attributes;
		expect(shorthand).toMatchObject({ type: "Attribute", name: "ontap" });
		expect(keyedText.charAt(shorthand!.start)).toBe("{");
		expect(spread?.type).toBe("SpreadAttribute");
		// `<svelte:element>` and a `css` option written as text.
		const dynamic = parse('<svelte:options css="injected" /><svelte:element this="view" />', {
			modern: true,
		});
		expect(dynamic.fragment.nodes.some((node) => node.type === "SvelteElement")).toBe(true);
		expect(dynamic.options?.attributes[0]).toMatchObject({
			name: "css",
			value: [{ type: "Text", data: "injected" }],
		});
	},

	"if-block-branches": () => {
		const text = "{#if a}<A />{:else if b}<B />{:else}<C />{/if}";
		const [block] = parse(text, { modern: true }).fragment.nodes as AST.IfBlock[];
		expect(block).toMatchObject({ type: "IfBlock", elseif: false, test: { name: "a" } });
		const [a] = block!.consequent.nodes as (AST.Component & { start: number; end: number })[];
		expect(text.slice(a!.start, a!.end)).toBe("<A />");
		// The `{:else if}` is alone in the alternate, with branches of its own.
		const [elseIf, ...rest] = block!.alternate!.nodes as AST.IfBlock[];
		expect(rest).toEqual([]);
		expect(elseIf).toMatchObject({ type: "IfBlock", elseif: true, test: { name: "b" } });
		const [c] = elseIf!.alternate!.nodes as (AST.Component & { start: number; end: number })[];
		expect(text.slice(c!.start, c!.end)).toBe("<C />");
		expect(elseIf!.consequent.nodes[0]?.type).toBe("Component");
		expect(
			(parse("{@render s()}", { modern: true }).fragment.nodes[0] as { type: string }).type,
		).toBe("RenderTag");
	},

	"thread-branch-component": () => {
		const source =
			'<script>import Wrapper from "./wrapper.js"; import Child from "./Child.svelte";</script>' +
			"{#snippet s()}<Child />{/snippet}<Wrapper render={s} />";
		const passed =
			/Wrapper\((\$\$anchor|node(?:_\d+)?|\$\$renderer), \{\s*(?:render: s|get render\(\) \{\s*return s;\s*\})\s*\}\)/;
		for (const dev of [false, true]) {
			const client = compile(source, { ...clientOptions(), dev }).js.code;
			expect(client).toMatch(passed);
			// The snippet is a function of the anchor alone.
			expect(client).toMatch(
				/const s = \$\.renderer_snippet\(\$renderer, (?:\(\$\$anchor\) =>|\$\.wrap_snippet\(\w+, function \(\$\$anchor\))/,
			);
		}
		const server = compile(source, { filename: "Contract.svelte", generate: "server", runes: true })
			.js.code;
		expect(server).toContain("Wrapper($$renderer, { render: s });");
		expect(server).toMatch(/function s\(\$\$renderer\) \{/);
		// A component calls `$props.id()` first, on both threads.
		const id = "<script>const uid = $props.id();</script><view id={uid}></view>";
		expect(compile(id, clientOptions()).js.code).toMatch(
			/var \$\$previous_renderer = \$\.push_renderer\(\$renderer\);\s*try \{\s*const uid = \$\.props_id\(\);/,
		);
		expect(
			compile(id, { filename: "Contract.svelte", generate: "server", runes: true }).js.code,
		).toMatch(/function Contract\(\$\$renderer\) \{\s*const uid = \$\.props_id\(\$\$renderer\);/);
	},

	"options-unrecognised-error": () => {
		// A Svelte without custom renderers fails on the option by this code.
		const error = thrown(() => compileClient("<view></view>", { notAnOption: true }));
		expect(error?.code).toBe("options_unrecognised");
	},

	"incompatible-with-custom-renderer-error": () => {
		for (const [feature, markup] of BANNED) {
			const error = thrown(() => compileClient(markup));
			expect(error?.code, markup).toBe("incompatible_with_custom_renderer");
			expect(error?.message.split("\n")[0], markup).toBe(
				`${feature} is not compatible with \`customRenderer\``,
			);
		}
		// The compile option is ignored, so `<svelte:options>` is the one place a component sets it.
		expect(thrown(() => compileClient("<view></view>", {}, { css: "injected" }))).toBeUndefined();
	},

	"supported-features-compile": () => {
		for (const [name, markup] of SUPPORTED) {
			expect(
				thrown(() => compileClient(markup)),
				name,
			).toBeUndefined();
		}
		// The option that would switch the renderer off compiles; the binding refuses it itself.
		expect(
			thrown(() => compileClient("<svelte:options customRenderer={null} /><view></view>")),
		).toBeUndefined();
	},
};
