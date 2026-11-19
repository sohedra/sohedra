// Checked by `pnpm check`, not run. `@sohedra/lynx/host`: the host's values with reactive
// `.current`, augmentable data types, and `on(host, …)` with the arguments `HostEvents` gives each
// event, `unknown` for the ones it does not name.

import { globalProps, host, initData, keyboard, systemInfo } from "@sohedra/lynx/host";
import type { HostEvents, KeyboardState, PlatformType, SystemInfo } from "@sohedra/lynx/host";
import { on } from "svelte/events";

declare module "@sohedra/lynx/host" {
	interface InitData {
		route?: string;
	}
	interface GlobalProps {
		theme?: "light" | "dark";
	}
	interface HostEvents {
		cartchanged: [count: number];
	}
}

const route: string | undefined = initData.current.route;
const theme: "light" | "dark" | undefined = globalProps.current.theme;
const other: unknown = initData.current["anything"];
const platform: PlatformType = systemInfo.current.platform;
const ratio: number = systemInfo.current.pixelRatio;
const info: SystemInfo = systemInfo.current;
const state: KeyboardState = keyboard.current;
const open: boolean = keyboard.current.open;
const height: number = keyboard.current.height;
void [route, theme, other, platform, ratio, info, state, open, height];

const off: () => void = on(host, "keyboardstatuschanged", (status, size, same) => {
	const shown: "on" | "off" = status;
	const value: number = size;
	const android: number | undefined = same;
	void [shown, value, android];
});
off();
on(host, "onWindowResize", (width, tall) => void [width.toFixed(), tall.toFixed()]);
on(host, "onFontScaleChanged", ({ scale }) => void scale.toFixed());
on(host, "onDynamicComponentEvent", ({ code, data }) => void [code.toFixed(), data.url.length]);
on(host, "cartchanged", (count) => void count.toFixed());
on(host, "somethingelse", (...args) => {
	const given: unknown[] = args;
	void given;
});
const resized: HostEvents["onWindowResize"] = [390, 844];
void resized;

// @ts-expect-error `.current` is read-only.
initData.current = {};
// @ts-expect-error the keyboard's state is read-only.
keyboard.current.open = true;
// @ts-expect-error a known event's arguments are typed: the width is a number.
on(host, "onWindowResize", (width: string) => width);
// @ts-expect-error an unnamed event's arguments are unknown until HostEvents names them.
on(host, "somethingelse", (count: number) => count);
// @ts-expect-error SystemInfo names its fields.
void systemInfo.current.screenWidth;
