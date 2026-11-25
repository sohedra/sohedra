// What an app's entry and code write with the binding's public entries.

import { mount, mountPage, root, unmount } from "@sohedra/lynx";
import type { LynxNode, LynxTouchEvent } from "@sohedra/lynx/elements";
import { background, dev, mainThread } from "@sohedra/lynx/environment";
import { globalProps, host, initData, keyboard, systemInfo } from "@sohedra/lynx/host";
import type { PlatformType } from "@sohedra/lynx/host";
import { on } from "svelte/events";

import App from "./App.svelte";

mountPage(App, { props: { rows: [] } });

const flags: boolean[] = [background, dev, mainThread];
const platform: PlatformType = systemInfo.current.platform;
const height: number = keyboard.current.height;
void [flags, platform, height, initData.current, globalProps.current];

const off = on(root, "tap", (event: LynxTouchEvent<LynxNode, LynxNode<"page">>) => {
	const page: LynxNode<"page"> = event.currentTarget;
	void page;
});
off();
on(host, "onWindowResize", (width, tall) => void [width, tall]);

export function openLayer(holder: LynxNode): void {
	const layer = mount(App, { target: holder, props: { rows: [] } });
	unmount(layer);
}
