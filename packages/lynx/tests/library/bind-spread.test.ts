// A binding passed beside `{...rest}` (`<Inner bind:value bind:ref {...rest} />`) reaches the
// parent where PrimJS runs the background (Android, and iOS hosts that use it), which gives a
// Proxy's accessor back as a data descriptor. The emulation makes every Proxy do that; it is
// installed before Svelte loads, since Svelte takes `Object.getOwnPropertyDescriptor` once.

import { afterEach, describe, expect, it, rs } from "@rstest/core";

import { emulatePrimJSDescriptors } from "./primjs-descriptors.ts";

let restore: (() => void) | undefined;
let cleanup: (() => void) | undefined;

afterEach(() => {
	cleanup?.();
	restore?.();
	cleanup = restore = undefined;
});

/** The page's parent component, rendered by a fresh copy of Svelte and of the test library. */
async function renderParent(emulate: boolean) {
	rs.resetModules();
	if (emulate) restore = emulatePrimJSDescriptors();
	const testing = await import("@sohedra/lynx/testing");
	cleanup = testing.cleanup;
	const { default: BindSpread } = await import("../fixtures/library/BindSpread.svelte");
	await testing.render(BindSpread);
	return testing.screen;
}

describe("bind: beside a spread", { timeout: 30_000 }, () => {
	it("reaches the parent where descriptors are as in Node", async () => {
		const screen = await renderParent(false);
		expect(screen.getByText("value: inner")).toBeTruthy();
		expect(screen.getByText("ref: set")).toBeTruthy();
	});

	it("reaches the parent where a Proxy's accessor comes back as data, as in PrimJS", async () => {
		const screen = await renderParent(true);
		expect(screen.getByText("value: inner")).toBeTruthy();
		expect(screen.getByText("ref: set")).toBeTruthy();
	});
});
