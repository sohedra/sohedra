// The CSS loader gives the CSS the component's loader kept in the build's store.

import { describe, expect, it } from "@rstest/core";

import svelteComponentLoader from "../../../../src/build/loaders/svelte-component.ts";
import svelteCssLoader from "../../../../src/build/loaders/svelte-css.ts";
import { runLoader } from "./loader-context.ts";

const component = `<view class="a"></view>\n<style>\n.a { margin-top: 3px; }\n</style>\n`;

/** The query of the CSS import a component's loader wrote. */
async function compile(
	compiler: object,
	source = component,
	file = "Component.svelte",
): Promise<string> {
	const { code } = await runLoader(svelteComponentLoader, source, {
		compiler,
		file,
		options: { thread: "background", renderer: "@sohedra/lynx/internal/renderer", hot: false },
	});
	const request = /"([^"\n]*\.css![^"\n]*)"/.exec(code ?? "")![1]!;
	return /\?([^!]*)!/.exec(request)![1]!;
}

const loadCss = (query: string, compiler: object, file = "Component.svelte") =>
	runLoader(svelteCssLoader, "", {
		compiler,
		file,
		options: Object.fromEntries(new URLSearchParams(query)),
	});

describe("the CSS loader", () => {
	it("gives the CSS back from the store of the same build", async () => {
		const compiler = {};
		const { code, error } = await loadCss(await compile(compiler), compiler);
		expect(error).toBeNull();
		expect(code).toContain("margin-top: 3px");
	});

	it("is not found in another build's store: it fails and names the component", async () => {
		const query = await compile({});
		const { error } = await loadCss(query, {});
		expect(error).toBeInstanceOf(Error);
		expect(error).toMatchObject({ code: "css_not_stored", hideStack: true });
		expect(error?.message).toContain("Component.svelte");
		expect(error?.message).toContain("Delete node_modules/.cache");
	});
});

// A dev server's build lives as long as the session, and each change to a component's styles is
// a new key.
describe("the store, over a long session", () => {
	const edited = component.replace("3px", "4px");

	it("keeps only a component's newest styles: the ones before are dropped", async () => {
		const compiler = {};
		const before = await compile(compiler);
		const after = await compile(compiler, edited);
		expect(after).not.toBe(before);
		expect((await loadCss(after, compiler)).code).toContain("margin-top: 4px");
		expect((await loadCss(before, compiler)).error).toMatchObject({ code: "css_not_stored" });
	});

	it("keeps a component's styles when it compiles again with the same", async () => {
		const compiler = {};
		const first = await compile(compiler);
		expect(await compile(compiler)).toBe(first);
		expect((await loadCss(first, compiler)).code).toContain("margin-top: 3px");
	});

	it("keeps each component's own", async () => {
		const compiler = {};
		const first = await compile(compiler);
		const second = await compile(compiler, edited, "Other.svelte");
		await compile(compiler, edited);
		expect((await loadCss(second, compiler, "Other.svelte")).code).toContain("margin-top: 4px");
		expect((await loadCss(first, compiler)).error).toMatchObject({ code: "css_not_stored" });
	});
});
