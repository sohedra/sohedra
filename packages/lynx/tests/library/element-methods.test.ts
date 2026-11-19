// An element's own methods in a main-thread function (setStyleProperty, getAttribute,
// querySelector) call the main thread's element functions, which the test library's main thread
// has, as a device has.

import { expect, it } from "@rstest/core";
import { fireEvent, render } from "@sohedra/lynx/testing";

import ElementMethods from "../fixtures/library/ElementMethods.svelte";

async function setup() {
	const log: unknown[] = [];
	const page = await render(ElementMethods, { props: { log } });
	const tap = (name: string) => fireEvent.tap(page.container.querySelector(`.${name}`)!);
	return { ...page, log, tap, box: page.container.querySelector<HTMLElement>(".box")! };
}

it("sets a style property, and several", async () => {
	const { tap, box } = await setup();
	await tap("style");
	expect(box.style.opacity).toBe("0.5");
	expect(box.style.width).toBe("10px");
	expect(box.style.height).toBe("20px");
});

it("sets and reads attributes", async () => {
	const { tap, box, log } = await setup();
	await tap("attributes");
	expect(box.getAttribute("marked")).toBe("set");
	expect(log).toHaveLength(1);
	expect(String(log[0])).toMatch(/^set .*marked/);
});

it("finds elements below it", async () => {
	const { tap, log } = await setup();
	await tap("found");
	expect(log).toEqual(["true 2"]);
});

it("reads a computed style", async () => {
	const { tap, log } = await setup();
	await tap("style");
	await tap("computed");
	expect(log).toEqual(["0.5"]);
});

it("starts, pauses, plays and cancels an animation", async () => {
	const { tap, log } = await setup();
	await tap("animated");
	expect(log).toEqual(["animated"]);
});

it("calls a UI method", async () => {
	const { tap, log } = await setup();
	await tap("invoked");
	expect(log).toEqual(["invoked"]);
});
