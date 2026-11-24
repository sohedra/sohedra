// The messages of the plugin while it builds: the Svelte it compiles with, the engine it runs on,
// and the settings it overrides. They join the build's catalogue.

import type { Catalogue } from "../../wire/index.ts";

/** The details each plugin message is written from. */
export interface PluginDetails {
	// `range` is the Svelte this package was tested with, as its package.json writes it.
	svelte_missing: { root: string; range: string };
	svelte_without_renderers: { version: string; where: string; range: string };
	svelte_version_unverified: { version: string; where: string; range: string };
	lynx_engine_missing: Record<string, never>;
	template_plugin_versions: { engine: string; own: string; range: string };
	encoder_not_handed_over: { reason: string };
	svelte_config_invalid: { file: string; reason: string };
	svelte_config_option_owned: { key: string };
	svelte_config_option_unsupported: { key: string };
	svelte_async_unsupported: Record<string, never>;
	iife_ignored: { value: string };
	main_thread_asset_missing: { file: string };
	rsbuild_swc_missing: Record<string, never>;
	/** `packages` are the missing ones, as a list for the install command; `preset` the one run. */
	test_peers_missing: { packages: string[]; preset: string; root: string };
}

/** Names as a sentence lists them: `a`, `a and b`, `a, b and c`. */
function listOf(names: readonly string[]): string {
	if (!Array.isArray(names)) return String(names);
	return names.length < 2 ? names.join("") : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
}

/** The messages of the plugin. */
export const PLUGIN_CATALOGUE: Catalogue<PluginDetails> = {
	svelte_missing: {
		message: ({ root }) => `Svelte is not installed in ${root}.`,
		fix: ({ range }) => `Add Svelte ${range} to the app's package.json dependencies.`,
		docs: "svelte_missing",
	},
	svelte_without_renderers: {
		message: ({ version, where }) =>
			`The installed Svelte (${version}, ${where}) has no custom renderers.`,
		fix: ({ range }) =>
			`Install Svelte ${range}: custom renderers came in 5.59, and @sohedra/lynx is tested with that range.`,
		docs: "svelte_without_renderers",
	},
	svelte_version_unverified: {
		message: ({ version, where, range }) =>
			`The installed Svelte (${version}, ${where}) is outside the range @sohedra/lynx is tested with, ${range}.`,
		fix: ({ version, range }) =>
			`Install Svelte ${range}, or update @sohedra/lynx to a version tested with Svelte ${version}.`,
		docs: "svelte_version_unverified",
	},
	lynx_engine_missing: {
		message: () => "Lynx's build plugin is not set up, so there is no template to build.",
		fix: () =>
			"Build with rspeedy, or add `pluginLynx()` from @lynx-js/rsbuild-plugin to the Rsbuild config.",
		docs: "lynx_engine_missing",
	},
	template_plugin_versions: {
		message: ({ engine, own, range }) =>
			`Lynx's build plugin uses @lynx-js/template-webpack-plugin ${engine}, and @sohedra/lynx needs ${range} (it installs ${own}).`,
		fix: () =>
			"Update @lynx-js/rspeedy (or @lynx-js/rsbuild-plugin) so that its template plugin is in that range, or update @sohedra/lynx to a version that supports the engine's.",
		docs: "template_plugin_versions",
	},
	encoder_not_handed_over: {
		message: ({ reason }) =>
			`The Lynx encoder that @sohedra/lynx carries could not be given to the template plugin: ${reason}.`,
		fix: () =>
			"Add an override of @lynx-js/tasm to the exact version in @sohedra/lynx's package.json, install again, and report the error if it stays.",
		docs: "encoder_not_handed_over",
	},
	svelte_config_invalid: {
		message: ({ file, reason }) => `The Svelte config ${file} could not be read: ${reason}.`,
		fix: () =>
			"Export the config as the default export: `export default defineConfig({ … })` from @sohedra/lynx/config/svelte.",
		docs: "svelte_config_invalid",
	},
	svelte_config_option_owned: {
		message: ({ key }) =>
			`\`compilerOptions.${key}\` in svelte.config.js is set by @sohedra/lynx, so your value is ignored.`,
		fix: ({ key }) => `Remove \`${key}\` from the compiler options.`,
		docs: "svelte_config_option_owned",
	},
	svelte_config_option_unsupported: {
		message: ({ key }) =>
			`\`compilerOptions.${key}\` in svelte.config.js is not supported on Lynx, so it is ignored.`,
		fix: ({ key }) => `Remove \`${key}\` from the compiler options.`,
		docs: "svelte_config_option_unsupported",
	},
	svelte_async_unsupported: {
		message: () =>
			"`compilerOptions.experimental.async` in svelte.config.js turns on Svelte's async mode, which @sohedra/lynx does not support.",
		fix: () => "Remove `experimental.async` from the compiler options.",
		docs: "svelte_async_unsupported",
	},
	iife_ignored: {
		message: ({ value }) =>
			`\`output.iife\` is false for both threads, so your value (${value}) is ignored.`,
		fix: () =>
			"Remove `output.iife`: the main thread's script must not be wrapped in a function that runs at once, and the bundler has one setting for both threads.",
		docs: "iife_ignored",
	},
	main_thread_asset_missing: {
		message: ({ file }) => `The main thread's script ${file} is not in the build's output.`,
		fix: () =>
			"Remove `output.filename` and `output.distPath` overrides that rename the page's scripts, or report the setting.",
		docs: "main_thread_asset_missing",
	},
	rsbuild_swc_missing: {
		message: () => "Rsbuild's JavaScript rule has no SWC loader to build the page's scripts with.",
		fix: () =>
			"Do not remove the SWC loader from Rsbuild's `tools.bundlerChain`, and do not turn it off with `tools.swc: false`.",
		docs: "rsbuild_swc_missing",
	},
	test_peers_missing: {
		message: ({ packages, preset, root }) =>
			`\`${preset}\` runs the tests with ${listOf(packages)}, which ${packages.length === 1 ? "is" : "are"} not installed in ${root}.`,
		fix: ({ packages }) => `Add ${listOf(packages)} to the app's devDependencies.`,
		docs: "test_peers_missing",
	},
};
