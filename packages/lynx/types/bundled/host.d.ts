// `@sohedra/lynx/host`, bundled from the source by `pnpm -F @sohedra/lynx declarations`.

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
 * Read it in a component: there, module-level code gets `{}`.
 */
export const initData: {
	readonly current: InitData;
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
export const globalProps: {
	readonly current: GlobalProps;
};
/**
 * What Lynx says about the device and itself: the platform, the screen's size in physical pixels,
 * the pixel ratio and the versions. `.current` is not reactive: Lynx gives it once, as the page
 * starts, and does not change it while the page runs, even when the device rotates. For the page's
 * size as it changes, listen to `on(host, "onWindowResize", …)`.
 *
 * ```svelte
 * <script lang="ts">
 *   import { systemInfo } from "@sohedra/lynx/host";
 * </script>
 *
 * {#if systemInfo.current.platform === "iOS"}<text>On iOS</text>{/if}
 * ```
 */
export const systemInfo: {
	readonly current: SystemInfo;
};
/**
 * The host's events and their arguments, for `on(host, …)`. Add the events your host sends to type
 * them:
 *
 * ```ts
 * declare module "@sohedra/lynx/host" {
 *   interface HostEvents {
 *     cartchanged: [count: number];
 *   }
 * }
 * ```
 */
export interface HostEvents {
	/**
	 * The on-screen keyboard opened or closed, with its height in Lynx's layout units: iOS sends
	 * `("on", height)` and `("off", 0)`; Android `("on" | "off", height, height)`, again as the
	 * height changes. `keyboard` reads it for you.
	 */
	keyboardstatuschanged: [status: "on" | "off", height: number, sameHeight?: number];
	/** The Lynx view's size changed, in Lynx's layout units. */
	onWindowResize: [width: number, height: number];
	/** The device's font scale changed. */
	onFontScaleChanged: [
		change: {
			scale: number;
		},
	];
	/** Lynx says a bundle it was asked for did not load, which it has already reported. */
	onDynamicComponentEvent: [
		event: {
			code: number;
			data: {
				url: string;
				sync: boolean;
				error_msg: string;
				mode: string;
			};
		},
	];
}
/** A listener of the host's events: it gets the event's arguments. */
export type HostListener = (...args: never[]) => unknown;
/** What `host` is: a target for Svelte's `on()`. */
export interface Host {
	/** Listens to the host's event `type`; the listener gets the event's arguments. */
	addEventListener(type: string, listener: HostListener): void;
	/** Stops a listener `addEventListener` added. */
	removeEventListener(type: string, listener: HostListener): void;
}
/**
 * The target for the host's events, for Svelte's `on()`: in an effect or an attachment, which stops
 * listening when they end. The listener gets the event's arguments.
 *
 * ```svelte
 * <script lang="ts">
 *   import { on } from "svelte/events";
 *   import { host } from "@sohedra/lynx/host";
 *
 *   $effect(() => on(host, "onWindowResize", (width, height) => resize(width, height)));
 * </script>
 * ```
 *
 * The host's events reach the background thread only: on the main thread, its listeners throw. A
 * listener that throws is reported into Lynx, and the others still run. When the page ends, its
 * listeners are dropped.
 */
export const host: Host;
/** The on-screen keyboard, as `keyboard.current` gives it. */
export interface KeyboardState {
	/** Whether the keyboard is open. */
	readonly open: boolean;
	/**
	 * How much of the page the open keyboard covers, in Lynx's layout units; 0 while it is closed,
	 * and never below 0.
	 */
	readonly height: number;
}
/**
 * The on-screen keyboard: whether it is open, and how much of the page it covers. `.current` is
 * reactive: an effect or a template that reads it runs again when the keyboard opens, closes or
 * changes its height.
 *
 * ```svelte
 * <script lang="ts">
 *   import { keyboard } from "@sohedra/lynx/host";
 * </script>
 *
 * <view style:padding-bottom="{keyboard.current.height}px"><input /></view>
 * ```
 *
 * It listens from its first read to the page's end: a keyboard already open then reads as closed
 * until it changes. The height is Lynx's, in Lynx's layout units, and is measured to two edges: on
 * iOS against the window, from its bottom; on Android against the Lynx view, from its bottom. They
 * are the same when the Lynx view reaches the bottom of the window. It is never below 0: a Lynx view
 * that ends above the keyboard is not covered. On Android it changes several times while
 * the keyboard animates. On the main thread it is always closed.
 */
export const keyboard: {
	readonly current: KeyboardState;
};
/** The platforms Lynx runs on. `pc` is Lynx's older name for Windows and macOS. */
export type PlatformType = "Android" | "iOS" | "Harmony" | "windows" | "macOS" | "pc";
/** What Lynx says about the device and itself. */
export interface SystemInfo {
	/**
	 * The version of the Lynx Engine.
	 * @deprecated Use `engineVersion`.
	 * @example '2.4', '2.10'
	 */
	readonly lynxSdkVersion: string;
	/**
	 * The version of the Lynx Engine.
	 * @example '3.2'
	 */
	readonly engineVersion: string;
	/**
	 * The current operating system version.
	 * Not on the main thread.
	 */
	readonly osVersion: string;
	/** The physical pixel height of the real device. */
	readonly pixelHeight: number;
	/** The physical pixel width of the real device. */
	readonly pixelWidth: number;
	/** The physical pixel ratio of the real device. */
	readonly pixelRatio: number;
	/** The platform of the current device. */
	readonly platform: PlatformType;
	/**
	 * The JavaScript engine currently used.
	 * Not on the main thread: a template that shows it, or `osVersion`, is drawn without it in the first frame.
	 */
	readonly runtimeType: "v8" | "jsc" | "quickjs";
	/** The theme the host gave Lynx, if any. */
	readonly theme?: object;
}

export {};

declare module "svelte/events" {
	/**
	 * Listens to the host's event `type`, and returns a function that stops. The listener gets the
	 * event's arguments. Call it in an effect or an attachment, which stops it when they end.
	 */
	export function on<Type extends keyof HostEvents>(
		host: Host,
		type: Type,
		handler: (...args: HostEvents[Type]) => unknown,
	): () => void;
	/**
	 * Listens to an event the host sends that `HostEvents` does not name: its arguments are
	 * `unknown` until `HostEvents` names it.
	 */
	export function on(
		host: Host,
		type: string,
		handler: (...args: unknown[]) => unknown,
	): () => void;
}
