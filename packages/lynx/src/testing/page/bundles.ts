// Lazy bundles on a test page: `lynx.fetchBundle` and `lynx.loadScript` on each thread, over the
// bundles a test gives the page by URL. The engine fake reads no bundle file: each section is what
// running it answers.

/** A lazy bundle a test page serves. */
export interface TestBundle {
	/** What Lynx answers the fetch with: 0, the default, when the bundle arrived. */
	code?: number;
	/** Why it did not arrive, as Lynx says. */
	message?: string;
	/** Runs the bundle's background section: what it answers is what `loadScript` answers. */
	background?: () => unknown;
	/**
	 * Runs the bundle's main-thread section: what it answers is what `loadScript` answers, a
	 * function of the bundle's entry. Without one, the section is empty, and `loadScript` throws.
	 */
	mainThread?: () => unknown;
	/** The bundle's style sheet, which `__LoadStyleSheet("CSS", url)` answers. */
	styles?: unknown;
}

/** What Lynx answers a fetch with (core/runtime/lepus/bindings/renderer_functions.cc, FetchBundle). */
export interface FetchAnswer {
	code: number;
	url: string;
	error_msg: string;
}

/** The fetch and the sections of the bundles a test page serves. */
export function createBundles(bundles: Readonly<Record<string, TestBundle>>): {
	/** What Lynx answers the fetch of `url` with; throws for a URL the page does not serve. */
	answer(url: string): FetchAnswer;
	/** Runs `section` of the fetched bundle `bundleName`, as `lynx.loadScript` does. */
	load(section: "background" | "main-thread", bundleName: string): unknown;
} {
	const find = (url: string): TestBundle => {
		const bundle = bundles[url];
		if (!bundle)
			throw new Error(
				`The test page serves no bundle at ${url}: give it in the page's bundles. ` +
					"What Lynx answers for an address it cannot reach is not checked.",
			);
		return bundle;
	};
	return {
		answer(url) {
			const { code = 0, message = "" } = find(url);
			return { code, url, error_msg: message };
		},
		load(section, bundleName) {
			const bundle = find(bundleName);
			const run = section === "background" ? bundle.background : bundle.mainThread;
			if (!run)
				// The engine's own words (renderer_functions.cc, LoadScript).
				throw new Error(
					`lynx.loadScript's script is empty.key: ${section}, bundleName: ${bundleName}`,
				);
			return run();
		},
	};
}
