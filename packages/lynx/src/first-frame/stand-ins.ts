// What `@sohedra/lynx` exports that only the background has: the page's layers, its root and its
// static copies. On the main thread each is a stand-in that throws one error, which says where it
// works: a component's top-level code runs here as the first frame is drawn, and imports them all.

import { firstFrameError } from "./catalogue.ts";
import { firstFrame } from "./globals.ts";

/** The error of a call of `call` on the main thread. */
const onMainThread = (call: string): Error =>
	firstFrameError({ code: "called_on_main_thread", details: { call } });

/** `mount` on the main thread: see the background's. */
export function mount(..._args: unknown[]): never {
	throw onMainThread("mount");
}

/** `unmount` on the main thread: see the background's. */
export function unmount(..._args: unknown[]): never {
	throw onMainThread("unmount");
}

/** `createStaticCopy` on the main thread: see the background's. */
export function createStaticCopy(..._args: unknown[]): never {
	throw onMainThread("createStaticCopy");
}

/**
 * The page's root on the main thread: a value to import. Its questions have answers, since none of
 * the background's nodes is here, as a root before its page; listening on it throws, since a
 * listener here would never be called.
 */
export const root: {
	readonly tag: "page";
	readonly isConnected: false;
	contains(other: unknown): false;
	addEventListener(...args: unknown[]): never;
	removeEventListener(...args: unknown[]): never;
} = {
	tag: "page",
	isConnected: false,
	contains: () => false,
	// Named as the developer writes it: `on()` is the documented way to listen.
	addEventListener() {
		throw onMainThread("on(root, …)");
	},
	removeEventListener() {
		throw onMainThread("on(root, …)");
	},
};

/** Reports an error into Lynx from the main thread. Never throws over the error it reports. */
export function reportError(error: unknown): void {
	try {
		firstFrame.lynx.reportError(error);
	} catch {
		// Reporting must never throw over the error.
	}
}
