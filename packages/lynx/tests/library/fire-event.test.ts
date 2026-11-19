// `fireEvent` takes a Lynx event by name, with its fields, or a DOM event as the Lynx event it
// stands for; a touch travels the tree, any other event reaches its element only, if it listens.

import { expect, it } from "@rstest/core";
import { fireEvent, render, screen } from "@sohedra/lynx/testing";

import Counter from "../fixtures/library/Counter.svelte";
import Input from "../fixtures/library/Input.svelte";

it("takes a DOM event: a bubbling tap reaches the button's handler", async () => {
	await render(Counter);
	const tap = new Event("tap", { bubbles: true });
	expect(await fireEvent(screen.getByText("Add 1"), tap)).toBe(true);
	expect(screen.getByText("Count: 1")).toBeTruthy();
});

it("sends a custom event only to an element that listens to it", async () => {
	const { container } = await render(Input);
	expect(await fireEvent.scroll(container.querySelector(".echo")!)).toBe(true);
	await fireEvent(container.querySelector(".field")!, "input", { detail: { value: "typed" } });
	expect(container.querySelector(".echo")!.textContent).toBe("typed");
});

it("keeps a tap told not to bubble on its element", async () => {
	await render(Counter);
	await fireEvent.tap(screen.getByText("Add 1"), { bubbles: false });
	expect(screen.getByText("Count: 0")).toBeTruthy();
});
