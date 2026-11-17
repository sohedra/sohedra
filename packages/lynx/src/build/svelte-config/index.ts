// The one line of an app's `svelte.config.js`: `export default svelteConfig()`. The plugin reads
// the file, and so do the editor and `svelte-check`, so they compile a component as the build
// does. This file is loaded by editors, so it imports no build code.

import type { CompileOptions, PreprocessorGroup, Warning } from "../../svelte/build/index.ts";
import { RENDERER_ENTRY } from "../../wire/index.ts";

/**
 * The Svelte compiler options an app sets. The rest are set by the binding (`generate`,
 * `fragments`, `css`, `dev`, `runes`, `experimental.customRenderer`) or not supported (Svelte 4's
 * `accessors`, `immutable`, `compatibility`; `customElement`). `cssHash` names the scoping class
 * of a component's `<style>`.
 */
export type SvelteLynxCompilerOptions = Pick<
	CompileOptions,
	| "warningFilter"
	| "rootDir"
	| "preserveComments"
	| "preserveWhitespace"
	| "discloseVersion"
	| "cssHash"
> & {
	experimental?: Pick<NonNullable<CompileOptions["experimental"]>, "async">;
};

/** What `svelteConfig()` takes: the app's own Svelte options. */
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
 * Svelte warnings that do not apply on Lynx. `attribute_illegal_colon`: a main-thread attribute is
 * written `main-thread:ontap`, and Lynx has no other attribute with a colon.
 */
const IGNORED_WARNINGS: ReadonlySet<string> = new Set(["attribute_illegal_colon"]);

/** The app's `warningFilter`, behind the warnings that do not apply on Lynx. */
export function lynxWarningFilter(
	appFilter?: (warning: Warning) => boolean,
): (warning: Warning) => boolean {
	return (warning) =>
		!IGNORED_WARNINGS.has(warning.code) && (appFilter === undefined || appFilter(warning));
}

/**
 * The Svelte config of a Lynx app: your options, with runes and the custom renderer on. Async
 * support is Svelte's own (off); set `compilerOptions.experimental.async` to turn it on.
 *
 * ```js
 * // svelte.config.js
 * import { svelteConfig } from "@sohedra/lynx/config/svelte";
 *
 * export default svelteConfig();
 * ```
 */
export function svelteConfig(options: SvelteConfigOptions = {}): SvelteConfig {
	const { compilerOptions = {}, preprocess = [] } = options;
	return {
		compilerOptions: {
			...compilerOptions,
			runes: true,
			warningFilter: lynxWarningFilter(compilerOptions.warningFilter),
			experimental: { ...compilerOptions.experimental, customRenderer: RENDERER_ENTRY },
		},
		preprocess: [preprocess].flat(),
	};
}
