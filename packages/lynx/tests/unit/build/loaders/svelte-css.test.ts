// The CSS loader gives the CSS the component's loader kept in the build's store.

import { describe, expect, it } from "@rstest/core";

import svelteComponentLoader from "../../../../src/build/loaders/svelte-component.ts";
import svelteCssLoader from "../../../../src/build/loaders/svelte-css.ts";
import { runLoader } from "./loader-context.ts";

const component = `<view class="a"></view>\n<style>\n.a { margin-top: 3px; }\n</style>\n`;

/** The query of the CSS import a component's loader wrote. */
async function compile(compiler: object): Promise<string> {
	const { code } = await runLoader(svelteComponentLoader, component, {
		compiler,
		options: { thread: "background", renderer: "@sohedra/lynx/internal/renderer", hot: false },
	});
	const request = /"([^"\n]*\.css![^"\n]*)"/.exec(code ?? "")![1]!;
	return /\?([^!]*)!/.exec(request)![1]!;
}

const loadCss = (query: string, compiler: object) =>
	runLoader(svelteCssLoader, "", {
		compiler,
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
