// `<svelte:options customRenderer>` in a component: Svelte reads a string (a renderer module) or
// `null` (compile as DOM code). `null` cannot work in a Lynx page: DOM code needs a DOM. And
// `css="injected"` needs a document to put the styles into.

import { describe, expect, it } from "@rstest/core";

import { inApp, withoutRoot } from "../app.ts";
import { component } from "../compiling.ts";

const file = inApp("Component.svelte");
const withOptions = (attribute: string): string =>
	`<svelte:options ${attribute} />\n<view class="a"></view>\n`;

describe("<svelte:options customRenderer={null}>", () => {
	for (const thread of ["background", "main-thread"] as const) {
		it(`is an error that names the file and the place (${thread})`, async () => {
			const error = (await component(withOptions("customRenderer={null}"), { thread }).catch(
				(thrown: Error) => thrown,
			)) as Error & { code?: string };
			expect(error).toBeInstanceOf(Error);
			expect(error.code).toBe("renderer_option_off");
			expect(error.message).toContain(`${file}:1:17`);
			expect(error.message).toContain("^");
			expect(withoutRoot(error.message)).toMatchSnapshot();
		});
	}

	it("is found among other options", async () => {
		const error = await component(
			"<svelte:options runes customRenderer={null} />\n<view></view>\n",
		).catch((thrown: Error) => thrown);
		expect((error as Error).message).toContain(`${file}:1:23`);
	});

	it("leaves a component with no such option alone", async () => {
		expect((await component(withOptions("runes"))).code).toContain("$renderer");
	});

	it("leaves a renderer given by name to Svelte", async () => {
		const { code } = await component(
			withOptions('customRenderer="@sohedra/lynx/internal/renderer"'),
		);
		expect(code).toContain("$renderer");
	});
});

describe('<svelte:options css="injected">', () => {
	it("is an error that says the build writes the styles to the page's stylesheet", async () => {
		const error = (await component(withOptions('css="injected"')).catch(
			(thrown: Error) => thrown,
		)) as Error & { code?: string };
		expect(error.code).toBe("css_injected");
		expect(error.message).toContain(`${file}:1:17`);
		expect(withoutRoot(error.message)).toMatchSnapshot();
	});
});
