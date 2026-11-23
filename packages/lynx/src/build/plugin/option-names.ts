// The options of `pluginSvelteLynx()`: their names, in the order the docs list them, and the key
// the plugin keeps them under.

/** Every option of `pluginSvelteLynx()`. */
export const PLUGIN_OPTION_NAMES: readonly string[] = [
	"engineVersion",
	"firstFrame",
	"define",
	"singleCopy",
	"pageConfig",
	"svelte",
];

/**
 * The registry key under which the plugin keeps the options it was given, for the Vitest preset to
 * read from an app's config.
 */
export const PLUGIN_OPTIONS: unique symbol = Symbol.for("@sohedra/lynx:plugin-options");
