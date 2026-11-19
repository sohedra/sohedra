// A component's `<style>` and an imported `.css` file are left out of the test page: the element
// keeps Svelte's scoping class, and nothing is added to the document.

import { expect, it } from "@rstest/core";
import { render } from "@sohedra/lynx/testing";

import Styled from "../fixtures/library/Styled.svelte";

it("scopes the element and adds no style sheet", async () => {
	const { container } = await render(Styled);
	const card = container.querySelector("view")!;
	expect(card.getAttribute("class")).toMatch(/^card svelte-\w+$/);
	expect(document.querySelectorAll("style, link[rel=stylesheet]")).toHaveLength(0);
});

it("gives a CSS Modules import its class name", async () => {
	const { container } = await render(Styled);
	expect(container.querySelector("view")?.getAttribute("data-module")).toMatch(/\w/);
});
