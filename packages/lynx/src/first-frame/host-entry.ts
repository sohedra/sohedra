// `@sohedra/lynx/host` on the main thread, where components import it as they draw the first frame.
// The frame is drawn once and listens to nothing: each value is what the frame is drawn with, not
// reactive, and the host's events reach the background only. Its background side is
// ../background/host-entry.ts.

import { firstFrameError } from "./catalogue.ts";
import { drawingData } from "./drawing.ts";
import { firstFrame } from "./globals.ts";

/** The page's data the first frame is drawn from. */
export const initData: { readonly current: Record<string, unknown> } = {
	get current() {
		return drawingData();
	},
};

/** The host's global props, as the engine gives them to the main thread. */
export const globalProps: { readonly current: Record<string, unknown> } = {
	get current() {
		return firstFrame.lynx.__globalProps ?? {};
	},
};

/** What Lynx says about the device and itself. */
export const systemInfo: { readonly current: Record<string, unknown> } = {
	get current() {
		return firstFrame.lynx.SystemInfo ?? {};
	},
};

const CLOSED = { open: false, height: 0 } as const;

/** The on-screen keyboard: closed, as the first frame is drawn before it opens. */
export const keyboard: { readonly current: { readonly open: boolean; readonly height: number } } = {
	get current() {
		return CLOSED;
	},
};

/** The error of a listener added or removed on the main thread, named as the developer writes it. */
const onMainThread = (): Error =>
	firstFrameError({ code: "called_on_main_thread", details: { call: "on(host, …)" } });

/**
 * The host's events on the main thread, which they never reach: its listeners throw, and Lynx is
 * asked for nothing.
 */
export const host: {
	addEventListener(...args: unknown[]): never;
	removeEventListener(...args: unknown[]): never;
} = {
	addEventListener() {
		throw onMainThread();
	},
	removeEventListener() {
		throw onMainThread();
	},
};
