// `keyboard`: the on-screen keyboard as a reactive value, from Lynx's `keyboardstatuschanged`
// event. It listens from the first read of `.current` to the page's end: Android starts detecting
// the keyboard only once something listens, and the value stays right between two effects that
// read it.

import { signal } from "../../svelte/runtime/index.ts";
import { host } from "./events.ts";

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

const CLOSED: KeyboardState = { open: false, height: 0 };

/**
 * The keyboard as one `keyboardstatuschanged` event gives it, on either platform: iOS sends
 * `("on", height)` and `("off", 0)`, Android `("on" | "off", height, height)`. The height is Lynx's
 * number as it came while the keyboard is open, and 0 once it closes: Android measures even a
 * closed keyboard to the Lynx view's bottom, which is not 0 when something sits below the view.
 * It is never below 0: Android sends a negative height when the Lynx view ends above the open
 * keyboard's top, where the keyboard covers none of the page.
 *
 * @workaround keyboard-closed-height kind=lynx-gap delete-when="Lynx sends a height of 0 with every off status of keyboardstatuschanged, on Android too"
 */
export function keyboardState(status: unknown, height: unknown): KeyboardState {
	if (status !== "on") return CLOSED;
	return { open: true, height: typeof height === "number" && height > 0 ? height : 0 };
}

const state = signal(CLOSED);

function update(...args: unknown[]): void {
	const next = keyboardState(args[0], args[1]);
	const current = state.read();
	if (next.open !== current.open || next.height !== current.height) state.write(next);
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
export const keyboard: { readonly current: KeyboardState } = {
	get current() {
		// The host keeps one listener added twice: only the first read adds it.
		host.addEventListener("keyboardstatuschanged", update);
		return state.read();
	},
};

/** The page has ended, and its listener with it: the next read listens again, from closed. */
export function resetKeyboard(): void {
	state.write(CLOSED);
}
