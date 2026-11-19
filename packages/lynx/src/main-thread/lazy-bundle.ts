// Lazy bundles on the main thread (../background/lazy-bundle.ts loads them). Once the background
// has a bundle, it asks the main thread to take it (`LAZY_BUNDLE_METHOD`): its main-thread section
// runs, a function that answers the bundler's chunk, whose modules are installed and run, which
// registers its main-thread functions; then its styles are adopted. All of it before the
// background shows the bundle's components.
//
// An `import()` as the first frame is drawn only starts the download: it never settles, and the
// first frame shows the pending branch of an `{#await}`, or a `<svelte:boundary>`'s `pending`.
//
// Adapted from @lynx-js/react (packages/react/runtime/src/snapshot/lynx/prepareLazyBundleMTS.ts),
// Apache License 2.0.

import type { LazyBundleParams } from "../wire/index.ts";
import { mainThreadError } from "./catalogue.ts";
import { bundlerRequire, mainThread } from "./globals.ts";
import type { BundlerChunk } from "./globals.ts";

/** How long to wait for a bundle the background already has: the engine keeps it. */
const WAIT_SECONDS = 5;

/** The bundles taken, by URL: each is taken once for the life of the view. */
const taken = new Set<string>();

/**
 * Takes the lazy bundle the background loaded: runs its main-thread code and adopts its styles,
 * once per bundle. What fails is reported, and the next import tries again.
 */
export function takeLazyBundle(params: LazyBundleParams, report: (error: unknown) => void): void {
	const { url } = params;
	if (taken.has(url)) return;
	const { lynx } = mainThread;
	try {
		const bundle = lynx.fetchBundle(url, {}).wait(WAIT_SECONDS);
		if (!bundle || bundle.code !== 0)
			throw mainThreadError({ code: "lazy_bundle_not_on_main_thread", details: { url } });
		taken.add(url);
		const evaluate = mainThreadSection(bundle.url);
		const chunk = evaluate?.(url);
		const runtime = bundlerRequire();
		if (chunk && chunk.modules && runtime) {
			if (runtime.C) runtime.C(chunk);
			for (const id of Object.keys(chunk.modules)) runtime(id);
		}
		const sheet = mainThread.__LoadStyleSheet("CSS", bundle.url);
		if (sheet !== undefined && sheet !== null) mainThread.__AdoptStyleSheet(sheet);
	} catch (error) {
		report(error);
	}
}

/**
 * The bundle's main-thread section, or none. A bundle the first frame's build never saw an
 * `import()` of (one whose specifier is not a string) has no main-thread code, and Lynx throws for
 * its empty section; its styles are still adopted.
 */
function mainThreadSection(bundleName: string): ((entry: string) => BundlerChunk) | undefined {
	try {
		// Boundary: the section is the bundler's chunk wrapped in a function of its entry.
		return mainThread.lynx.loadScript("main-thread", { bundleName }) as (
			entry: string,
		) => BundlerChunk;
	} catch {
		return undefined;
	}
}

/**
 * `import()` on the main thread, which only the first frame makes: it starts the download, for the
 * background to find it sooner, and never settles.
 */
export function installLazyBundles(): void {
	const { lynx } = mainThread;
	lynx.loadLazyBundle = (url) => {
		try {
			lynx.fetchBundle(url, {});
		} catch {
			// Only a head start: the background loads it anyway.
		}
		return new Promise(() => {});
	};
}
