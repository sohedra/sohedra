// Main-thread functions run in a test written with the public library: the main thread has the
// binding's runtime for them, as on a device.

import { expect, it } from "@rstest/core";
import { fireEvent, render } from "@sohedra/lynx/testing";

import MainThreadFunctions from "../fixtures/library/MainThreadFunctions.svelte";

async function setup() {
	const log: unknown[] = [];
	const page = await render(MainThreadFunctions, { props: { log } });
	const tap = (name: string) => fireEvent.tap(page.container.querySelector(`.${name}`)!);
	return { ...page, log, tap };
}

it("runs a main-thread:ontap handler when the element is tapped", async () => {
	const { log, tap } = await setup();
	await tap("box");
	expect(log).toEqual(["main-thread tap"]);
});

it("resolves runOnMainThread(fn)() with what fn returns", async () => {
	const { log, tap } = await setup();
	await tap("double");
	expect(log).toEqual([42]);
});

it("lets a main-thread function call back with runOnBackground, and hear the reply", async () => {
	const { log, tap } = await setup();
	await tap("sum");
	expect(log).toEqual(["sum 3"]);
});

it("reads an element's main-thread:ref inside a main-thread function", async () => {
	const { log, tap } = await setup();
	await tap("bound");
	expect(log).toEqual(["bound true"]);
});
