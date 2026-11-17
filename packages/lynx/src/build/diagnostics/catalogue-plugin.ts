// The messages of the plugin while it builds: the Svelte it compiles with, the engine it runs on,
// and the settings it overrides. They join the build's catalogue.

import type { Catalogue } from "../../wire/index.ts";

/** The details each plugin message is written from. */
export interface PluginDetails {
	svelte_missing: { root: string };
	svelte_without_renderers: { version: string; where: string };
	lynx_engine_missing: Record<string, never>;
	template_plugin_versions: { engine: string; own: string };
	encoder_not_handed_over: { reason: string };
	svelte_config_invalid: { file: string; reason: string };
	svelte_config_option_owned: { key: string };
	svelte_config_option_unsupported: { key: string };
	iife_ignored: { value: string };
	main_thread_asset_missing: { file: string };
	rsbuild_swc_missing: Record<string, never>;
}

const SVELTE_BUILD = "the Svelte build with custom renderers (sveltejs/svelte#18042)";

/** The messages of the plugin. */
export const PLUGIN_CATALOGUE: Catalogue<PluginDetails> = {
	svelte_missing: {
		message: ({ root }) => `Svelte is not installed in ${root}.`,
		fix: () => `Add ${SVELTE_BUILD} to the app's package.json dependencies.`,
		docs: "svelte_missing",
	},
	svelte_without_renderers: {
		message: ({ version, where }) =>
			`The installed Svelte (${version}, ${where}) has no custom renderers.`,
		fix: () => `Install ${SVELTE_BUILD}, which @sohedra/lynx is built for.`,
		docs: "svelte_without_renderers",
	},
	lynx_engine_missing: {
		message: () => "The Lynx build engine is not set up, so there is no template to build.",
		fix: () =>
			"Build with rspeedy, or add `pluginLynx()` from @lynx-js/rsbuild-plugin to the Rsbuild config.",
		docs: "lynx_engine_missing",
	},
	template_plugin_versions: {
		message: ({ engine, own }) =>
			`The Lynx build engine uses @lynx-js/template-webpack-plugin ${engine}, and @sohedra/lynx uses ${own}.`,
		fix: () =>
			"Install one version of both: update @lynx-js/rspeedy and @sohedra/lynx together, and run your package manager's dedupe.",
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
			"Export the config as the default export: `export default svelteConfig({ … })` from @sohedra/lynx/config/svelte.",
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
};
