// The host's data and global props, as the page reads them from `@sohedra/lynx/host`, from the
// first frame on; their updates, and a reload with data to add.

import { expect, it } from "@rstest/core";
import { render, screen } from "@sohedra/lynx/testing";

import HostData from "../fixtures/library/HostData.svelte";

it("draws the data and global props the host opened the page with", async () => {
	await render(HostData, { lynx: { initData: { route: "home" }, globalProps: { theme: "dark" } } });
	expect(screen.getByText("route home, theme dark")).toBeTruthy();
});

it("follows the host's updates of either", async () => {
	const { lynx } = await render(HostData, { lynx: { initData: { route: "home" } } });
	await lynx.updateInitData({ route: "cart" });
	expect(screen.getByText("route cart, theme undefined")).toBeTruthy();
	await lynx.updateGlobalProps({ theme: "light" });
	expect(screen.getByText("route cart, theme light")).toBeTruthy();
});

it("reloads the page with data to add", async () => {
	const { lynx } = await render(HostData, { lynx: { initData: { route: "home" } } });
	await lynx.reload({ route: "settings" });
	expect(screen.getByText("route settings, theme undefined")).toBeTruthy();
});
