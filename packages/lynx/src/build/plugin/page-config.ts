// The page's Lynx settings: `pageConfig`, the template plugin's options, and the switches that
// pick the engine's newer paths.

/** What a page-config key takes: Lynx's page config has booleans, numbers, strings and lists of strings. */
export type PageConfigValue = boolean | number | string | string[];

/** Page-config keys and their values. */
export type PageConfig = Record<string, PageConfigValue>;

/** The template plugin's own options, with ReactLynx's defaults: the keys of `pageConfig` that go to it. */
const TEMPLATE_DEFAULTS = {
	customCSSInheritanceList: undefined,
	debugInfoOutside: true,
	defaultDisplayLinear: true,
	enableAccessibilityElement: false,
	enableCSSInheritance: false,
	enableCSSInvalidation: true,
	removeDescendantSelectorScope: true,
} as const;

/** The keys of `pageConfig` the template plugin has an option for. */
export const TEMPLATE_KEYS: readonly string[] = Object.keys(TEMPLATE_DEFAULTS);

/**
 * The keys the plugin sets whatever the app says: the engine's newer paths, the engine version
 * (`targetSdkVersion`, from `engineVersion`), CSS scoping (Svelte scopes a component's styles
 * itself), what makes the template, and what the main-thread assets plugin sets.
 */
export const FORCED_PAGE_CONFIG: readonly string[] = [
	"enableA11y",
	"targetSdkVersion",
	"enableRemoveCSSScope",
	"dsl",
	"chunks",
	"filename",
	"intermediate",
	"cssPlugins",
	"lazyBundleFetcher",
	"lazyBundleFilename",
	"enableEventHandleRefactor",
	"enableMicrotaskPromisePolyfill",
	"debugMetadataUrl",
];

/**
 * The engine switches whose default at Lynx 4.2 (the oldest target) is the older path, with the
 * value of the newer one. The plugin sets them after the app's page config and `pluginLynxConfig`'s.
 * `enableA11y` is the Android helper mode the accessibility properties need; `enableNewGesture` is
 * the native gesture detectors that `main-thread:gesture` needs; `enableAutoNonFlatten` is
 * Android's real view for an element that needs one.
 *
 * @workaround engine-newer-paths kind=lynx-gap delete-when="the oldest Lynx the binding builds for defaults these switches to the newer path"
 */
export const NEW_PATH_PAGE_CONFIG: Readonly<Record<string, boolean>> = {
	enableNativeList: true,
	enableNewSticky: true,
	enableNewIntersectionObserver: true,
	enableA11y: true,
	enableNewGesture: true,
	enableAutoNonFlatten: true,
};

/**
 * The compile options among those switches: the Fiber element API, which the whole binding is
 * built on, and CSS selector matching, which a Svelte descendant or sibling selector needs.
 */
export const NEW_PATH_COMPILER_OPTIONS: Readonly<Record<string, boolean>> = {
	enableFiberArch: true,
	enableCSSSelector: true,
};

/**
 * The page-config keys that are not template options, with the plugin's defaults.
 * `enableCSSInlineVariables`: a `--x` in a style does nothing on the engine without it.
 * `enableFetchAPIStandardStreaming`: a fetched response's body streams as it arrives, which the
 * polyfill folder's `fetch` gives as a `ReadableStream`.
 */
const PAGE_CONFIG_DEFAULTS: PageConfig = {
	enableCSSInlineVariables: true,
	enableFetchAPIStandardStreaming: true,
};

/** The page's settings, split by where they go. */
export interface ResolvedPageConfig {
	/** The template plugin's options. */
	template: Record<string, unknown>;
	/** The other keys, which go into the encoder's config. */
	pageConfig: PageConfig;
}

/** `pageConfig` with the plugin's defaults, the template's keys split from the rest. */
export function resolvePageConfig(input: PageConfig | undefined): ResolvedPageConfig {
	const template: Record<string, unknown> = { ...TEMPLATE_DEFAULTS };
	const pageConfig: PageConfig = { ...PAGE_CONFIG_DEFAULTS };
	for (const [key, value] of Object.entries(input ?? {})) {
		if (value === undefined) continue;
		if (TEMPLATE_KEYS.includes(key)) template[key] = value;
		else pageConfig[key] = value;
	}
	return { template, pageConfig };
}

/**
 * What `pluginLynxConfig` sets wins over the plugin's and the app's. It encodes its own keys, so
 * the ones it sets leave `pageConfig`.
 */
export function applyLynxConfig(
	resolved: ResolvedPageConfig,
	lynxConfig: Record<string, unknown>,
): void {
	for (const key of TEMPLATE_KEYS)
		if (Object.hasOwn(lynxConfig, key)) resolved.template[key] = lynxConfig[key];
	for (const key of Object.keys(lynxConfig)) delete resolved.pageConfig[key];
}
