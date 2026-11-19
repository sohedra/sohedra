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
	/** How much of the page the open keyboard covers, in Lynx's layout units; 0 while it is closed. */
	readonly height: number;
}

const CLOSED: KeyboardState = { open: false, height: 0 };

/**
 * The keyboard as one `keyboardstatuschanged` event gives it, on either platform: iOS sends
 * `("on", height)` and `("off", 0)`, Android `("on" | "off", height, height)`. The height is Lynx's
 * number as it came.
 */
export function keyboardState(status: unknown, height: unknown): KeyboardState {
	if (status !== "on") return CLOSED;
	return { open: true, height: typeof height === "number" ? height : 0 };
}

const state = signal(CLOSED);
let listening = false;

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
 * iOS from the bottom of the window, on Android from the bottom of the Lynx view. They are the same
 * when the Lynx view reaches the bottom of the window. On Android it changes several times while
 * the keyboard animates. On the main thread it is always closed.
 */
export const keyboard: { readonly current: KeyboardState } = {
	get current() {
		if (!listening) {
			listening = true;
			host.addEventListener("keyboardstatuschanged", update);
		}
		return state.read();
	},
};

/** The page has ended: the next read listens again, from closed. */
export function resetKeyboard(): void {
	listening = false;
	state.write(CLOSED);
}
