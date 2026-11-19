// Lazy bundles on the background. An `import()` the build splits off is a Lynx bundle of its own,
// and the bundler's chunk loader asks `lynx.loadLazyBundle` for it. It loads on both threads, as
// ReactLynx loads one on Lynx's fetch path:
//
//   1. `lynx.fetchBundle(url)`          the engine downloads it, and keeps it
//   2. `lynx.loadScript("background")`  its background section runs; it answers the bundler's
//                                       chunk, which the chunk loader installs
//   3. `callLepusMethod(LAZY_BUNDLE_METHOD)`  the main thread runs its main-thread section and
//                                       adopts its styles (../main-thread/lazy-bundle.ts)
//
// The promise resolves after 3, so the patch that shows the bundle's components, with their
// main-thread functions and styles, reaches a main thread that has them. A bundle that did not
// arrive rejects without a report: Lynx reported it. One that takes too long is reported once, then
// rejects: Lynx says nothing of a request that never completes.
//
// Adapted from @lynx-js/react (packages/react/runtime/src/core/lynx/lazy-bundle.ts), Apache License
// 2.0.

import { LAZY_BUNDLE_METHOD } from "../wire/index.ts";
import type { LazyBundleParams } from "../wire/index.ts";
import { backgroundError } from "./catalogue.ts";
import { background } from "./globals.ts";
import type { FetchedBundle } from "./globals.ts";
import { reportError } from "./report.ts";

/** A URL's scheme, which a full URL starts with. */
const ABSOLUTE = /^[a-z][a-z\d+.-]*:/i;

/** `url` resolved against `base`, as a browser resolves a link; both as Lynx gives them. */
export function resolveUrl(url: string, base: string | undefined): string {
	if (ABSOLUTE.test(url) || !base || !ABSOLUTE.test(base)) return url;
	const scheme = base.slice(0, base.indexOf(":") + 1);
	if (url.startsWith("//")) return scheme + url;
	if (url.startsWith("/")) {
		// scheme://host[:port], without the base's path.
		const rest = base.slice(scheme.length);
		let origin = scheme;
		if (rest.startsWith("//")) {
			const slash = rest.indexOf("/", 2);
			origin += slash === -1 ? rest : rest.slice(0, slash);
		}
		return origin + url;
	}
	const path = base.split(/[?#]/)[0]!;
	return path.slice(0, path.lastIndexOf("/") + 1) + url;
}

/** The page's own URL, which lynx-core's app keeps (`srcName`). */
function pageUrl(): string | undefined {
	try {
		// Boundary: lynx-core's app keeps what the page was opened with here.
		const params = background.lynx.getApp()["_params"] as { srcName?: unknown } | undefined;
		return typeof params?.srcName === "string" ? params.srcName : undefined;
	} catch {
		return undefined;
	}
}

/**
 * How long a bundle may take, from the fetch to the main thread's answer. `lynx.fetchBundle` has
 * no timeout of its own, so one timer covers the whole load. 30 seconds: longer than a slow mobile
 * connection takes for a bundle of tens of kilobytes, and short enough that a `{#await}` does not
 * wait for a lost request for minutes.
 *
 * @workaround lazy-bundle-timeout kind=lynx-gap delete-when="lynx.fetchBundle answers a request that never completes with a failure of its own"
 */
const LOAD_TIMEOUT_MS = 30_000;

/** The error of a bundle Lynx did not deliver, with Lynx's answer as its `cause`. */
function notLoaded(url: string, bundle: FetchedBundle): Error {
	const error = backgroundError({
		code: "lazy_bundle_not_loaded",
		details: { url, code: bundle.code, reason: bundle.error_msg },
	});
	return Object.assign(error, { cause: bundle });
}

/**
 * Loads the lazy bundle at `path`: resolves with the bundler's chunk once both threads have it, and
 * rejects when it does not arrive. The chunk loader also passes a load mode and its own entry,
 * which ReactLynx reads for synchronous loads; the build writes no mode, so every load is this one.
 */
export function loadLazyBundle(path: string): Promise<unknown> {
	const { lynx } = background;
	const url = resolveUrl(path, pageUrl());
	return new Promise((resolve, reject) => {
		if (!ABSOLUTE.test(url)) {
			reject(backgroundError({ code: "lazy_bundle_address_not_full", details: { url: path } }));
			return;
		}
		// It settles once: an answer after the timeout, or after a failure, runs nothing.
		let settled = false;
		const timer = background.setTimeout(() => {
			const error = backgroundError({
				code: "lazy_bundle_timed_out",
				details: { url, seconds: LOAD_TIMEOUT_MS / 1000 },
			});
			// The only sign of a bundle that does not answer: Lynx says nothing of a request that
			// never completes, and Lynx Explorer's fetch never answers a missing one.
			reportError(error);
			fail(error);
		}, LOAD_TIMEOUT_MS);
		function fail(error: unknown): void {
			if (settled) return;
			settled = true;
			background.clearTimeout(timer);
			reject(error);
		}
		function done(chunk: unknown): void {
			// After a failure the promise has settled, and resolving it does nothing.
			settled = true;
			background.clearTimeout(timer);
			resolve(chunk);
		}
		try {
			lynx.fetchBundle(url, {}).then((bundle) => {
				if (settled) return;
				if (bundle.code !== 0) {
					fail(notLoaded(url, bundle));
					return;
				}
				try {
					const chunk = lynx.loadScript("background", { bundleName: bundle.url });
					const params: LazyBundleParams = { url };
					lynx.getNativeApp().callLepusMethod(LAZY_BUNDLE_METHOD, params, () => done(chunk));
				} catch (error) {
					fail(error);
				}
			});
		} catch (error) {
			fail(error);
		}
	});
}

/** Gives the bundler's chunk loader its loader, before the app's first `import()`. */
export function installLazyBundles(): void {
	background.lynx.loadLazyBundle = loadLazyBundle;
}
