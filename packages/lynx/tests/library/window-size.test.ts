// The page's size in a component: the screen's, from what Lynx says about the device as the page
// starts, then each `onWindowResize` the host sends, in Lynx's layout units.

import { expect, it } from "@rstest/core";
import { render, screen } from "@sohedra/lynx/testing";

import WindowSize from "../fixtures/library/WindowSize.svelte";

const systemInfo = { pixelWidth: 1080, pixelHeight: 2400, pixelRatio: 3 };

it("starts with the size systemInfo gives, from the first frame on", async () => {
	await render(WindowSize, { lynx: { systemInfo, background: false } });
	expect(screen.getByText("360x800")).toBeTruthy();
});

it("shows the new size after onWindowResize", async () => {
	const { lynx } = await render(WindowSize, { lynx: { systemInfo } });
	await lynx.sendHostEvent("onWindowResize", [800, 360]);
	expect(screen.getByText("800x360")).toBeTruthy();
	await lynx.sendHostEvent("onWindowResize", [400, 900]);
	expect(screen.getByText("400x900")).toBeTruthy();
});

it("starts the next page from systemInfo's size again", async () => {
	const first = await render(WindowSize, { lynx: { systemInfo } });
	await first.lynx.sendHostEvent("onWindowResize", [800, 360]);
	await first.unmount();
	await render(WindowSize, { lynx: { systemInfo } });
	expect(screen.getByText("360x800")).toBeTruthy();
});
