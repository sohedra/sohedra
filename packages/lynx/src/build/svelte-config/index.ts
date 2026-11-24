// What wraps an app's `svelte.config.js`: `export default defineConfig({ … })`, a regular Svelte
// config. The plugin reads the file and sets what a Lynx page needs itself, so a plain object builds
// the same; the editor and `svelte-check` read only the file, and `defineConfig()` gives them those
// settings, so they check a component as the build compiles it. This file is loaded by editors, so
// it imports no build code.

import type { CompileOptions, PreprocessorGroup } from "../../svelte/build/index.ts";
import { RENDERER_ENTRY } from "../../wire/index.ts";
import { lynxWarningFilter } from "./warning-filter.ts";

/**
 * The Svelte compiler options an app sets. The rest are set by the binding (`generate`,
 * `fragments`, `css`, `dev`, `runes`, `experimental.customRenderer`) or not supported (Svelte 4's
 * `accessors`, `immutable`, `compatibility`; `customElement`; Svelte's async mode,
 * `experimental.async`, which fails the build). `cssHash` names the scoping class of a component's
 * `<style>`.
 */
export type SvelteLynxCompilerOptions = Pick<
	CompileOptions,
	| "warningFilter"
	| "rootDir"
	| "preserveComments"
	| "preserveWhitespace"
	| "discloseVersion"
	| "cssHash"
>;

/** What `defineConfig()` takes: the app's own Svelte options, in Svelte's config shape. */
export interface SvelteConfigOptions {
	compilerOptions?: SvelteLynxCompilerOptions;
	/** Svelte preprocessors, run on each `.svelte` file before it compiles. */
	preprocess?: PreprocessorGroup | PreprocessorGroup[];
}

/** The shape the Svelte language tools and the plugin read from `svelte.config.js`. */
export interface SvelteConfig {
	compilerOptions: CompileOptions;
	preprocess: PreprocessorGroup[];
}

/**
 * The Svelte config of a Lynx app: your regular Svelte config, with runes, the custom renderer and
 * Lynx's warning filter on, so the editor and `svelte-check` check a component as the build
 * compiles it. A plain object builds the same, since the build sets those itself; only the editor
 * would miss Lynx's errors and warn on `main-thread:` attributes.
 *
 * ```js
 * // svelte.config.js
 * import { defineConfig } from "@sohedra/lynx/config/svelte";
 *
 * export default defineConfig({ compilerOptions: {}, preprocess: [] });
 * ```
 */
export function defineConfig(options: SvelteConfigOptions = {}): SvelteConfig {
	const { compilerOptions = {}, preprocess = [] } = options;
	// Boundary: a config in JavaScript may set `experimental.async` all the same; it is passed on, for
	// the build to refuse.
	const { experimental } = compilerOptions as Pick<CompileOptions, "experimental">;
	return {
		compilerOptions: {
			...compilerOptions,
			runes: true,
			warningFilter: lynxWarningFilter(compilerOptions.warningFilter),
			experimental: { ...experimental, customRenderer: RENDERER_ENTRY },
		},
		preprocess: [preprocess].flat(),
	};
}
