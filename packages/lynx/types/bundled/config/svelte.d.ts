// `@sohedra/lynx/config/svelte`, bundled from the source by `pnpm -F @sohedra/lynx declarations`.

import type { CompileOptions, PreprocessorGroup } from "svelte/compiler";
import * as Compiler from "svelte/compiler";
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
 * would miss Lynx's errors and warn on `main-thread:` attributes. Async support is Svelte's own
 * (off); set `compilerOptions.experimental.async` to turn it on.
 *
 * ```js
 * // svelte.config.js
 * import { defineConfig } from "@sohedra/lynx/config/svelte";
 *
 * export default defineConfig({ compilerOptions: {}, preprocess: [] });
 * ```
 */
export function defineConfig(options?: SvelteConfigOptions): SvelteConfig;

export {};
