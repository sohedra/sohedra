// What the host gives the page as values: its data, its global props and what Lynx says about the
// device. The page (../page.ts) keeps `lynx.__initData` and `lynx.__globalProps` current, and says
// when either changed, so effects that read them run again.

import { signal } from "../../svelte/runtime/index.ts";
import { background } from "../globals.ts";
import type { SystemInfo } from "./system-info.ts";

/**
 * The page's data: what the host opened the page with, and its updates. Add the keys your page
 * reads to type them:
 *
 * ```ts
 * declare module "@sohedra/lynx/host" {
 *   interface InitData {
 *     route?: string;
 *   }
 * }
 * ```
 */
export interface InitData {
	[key: string]: unknown;
}

/**
 * The host's global props: what the native app gives every page, such as a theme. Add the keys your
 * page reads to type them, as for `InitData`.
 */
export interface GlobalProps {
	[key: string]: unknown;
}

/** A count an effect reads to run again when it goes up. */
function changes(): { read(): void; bump(): void } {
	let count = 0;
	const version = signal(count);
	return { read: () => void version.read(), bump: () => version.write(++count) };
}

const initDataChanges = changes();
const globalPropsChanges = changes();

/** The page's data changed: what read `initData.current` in an effect reads it again. */
export const initDataChanged: () => void = initDataChanges.bump;

/** The host's global props changed: what read `globalProps.current` in an effect reads them again. */
export const globalPropsChanged: () => void = globalPropsChanges.bump;

/**
 * The page's data, as the host opened the page with it and as its updates left it. `.current` is
 * reactive: an effect or a template that reads it runs again when the host updates the data or
 * reloads the page with more.
 *
 * ```svelte
 * <script lang="ts">
 *   import { initData } from "@sohedra/lynx/host";
 * </script>
 *
 * <text>{initData.current.title}</text>
 * ```
 *
 * On the main thread, as a component draws the first frame, it is the data the frame is drawn from.
 */
export const initData: { readonly current: InitData } = {
	get current() {
		initDataChanges.read();
		return background.lynx.__initData;
	},
};

/**
 * The host's global props: what the native app gives every page, such as a theme. `.current` is
 * reactive: an effect or a template that reads it runs again when the host updates them.
 *
 * ```svelte
 * <script lang="ts">
 *   import { globalProps } from "@sohedra/lynx/host";
 *
 *   const dark = $derived(globalProps.current.theme === "dark");
 * </script>
 * ```
 *
 * On the main thread, as a component draws the first frame, it is the global props the frame is
 * drawn with.
 */
export const globalProps: { readonly current: GlobalProps } = {
	get current() {
		globalPropsChanges.read();
		return background.lynx.__globalProps ?? {};
	},
};

/**
 * What Lynx says about the device and itself: the platform, the screen's size in physical pixels,
 * the pixel ratio and the versions. `.current` is not reactive: Lynx gives it once, as the page
 * starts, and does not change it while the page runs, even when the device rotates. For the page's
 * size as it changes, read `svelte/reactivity/window`.
 *
 * ```svelte
 * <script lang="ts">
 *   import { systemInfo } from "@sohedra/lynx/host";
 * </script>
 *
 * {#if systemInfo.current.platform === "iOS"}<text>On iOS</text>{/if}
 * ```
 */
export const systemInfo: { readonly current: SystemInfo } = {
	get current() {
		return background.SystemInfo;
	},
};
