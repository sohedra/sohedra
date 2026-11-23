// The page's own `queueMicrotask`: the build points the free name `queueMicrotask` (and
// `globalThis.queueMicrotask`) in every module of the page's background script here
// (build/plugin/resolve.ts), so Svelte's work queues on this page's app and its errors reach this
// page's `onError`, wherever the realm's global came from.

import { runSvelte } from "./errors.ts";
import { background } from "./globals.ts";
import type { BackgroundGlobals } from "./globals.ts";
import { report } from "./report.ts";

/**
 * Queues `callback` on `lynx`'s microtask queue: lynx-core's `lynx.queueMicrotask` is the engine's
 * microtask queue itself. The bundle's `Promise` is lynx-core's, which ticks on that same queue in
 * the pages this plugin builds (it turns on `enableMicrotaskPromisePolyfill`; lynx-core's
 * setup-promise.ts): a promise would only add a step in between, and make a throw a rejection.
 *
 * What the callback throws is reported, into Lynx and to the page's `onError`: Svelte runs the
 * effects of a change made in a timer or a promise from here, and rethrows what one throws outside
 * every boundary. Lynx would report it too, as its own internal error, which `onError` never hears.
 */
export function queueOn(lynx: BackgroundGlobals["lynx"], callback: () => void): void {
	lynx.queueMicrotask(() => {
		try {
			runSvelte(callback);
		} catch (error) {
			report(error);
		}
	});
}

/**
 * Queues `callback` on this page's microtask queue. Pages of a `LynxGroup` share one background
 * realm (Lynx's js_realm_manager.cc), so the realm's global `queueMicrotask` is the first page's,
 * and drops what it is given once that page is gone (js_app.cc); each page's script has its own
 * copy of this module, which reads its own page's `lynx`.
 */
export function queueMicrotask(callback: () => void): void {
	queueOn(background.lynx, callback);
}
