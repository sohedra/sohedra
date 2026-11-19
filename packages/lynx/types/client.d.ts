// Ambient types for an app built with @sohedra/lynx. One line in the app sets them up:
//
//   /// <reference types="@sohedra/lynx/client" />
//
// - the build's own types, from Rsbuild (`import.meta.webpackHot`, asset imports, CSS modules):
//   the file rspeedy's client types refer to, so an app built with Rsbuild alone needs no
//   `@lynx-js/rspeedy`;
// - Lynx's elements for the Svelte language tools (elements.d.ts), which they read with
//   `"svelteOptions": { "namespace": "svelteLynx" }` in tsconfig.json;
// - `esm-env`, which the binding resolves from Svelte, and `background-only`, which it provides.

/// <reference types="@rsbuild/core/types" />
// oxlint-disable-next-line typescript/triple-slash-reference -- an import would make this file a module, which turns its `declare module`s into augmentations
/// <reference path="./elements.d.ts" />

// `.svelte` imports, for plain `tsc`, are Svelte's own: declaring them here too would declare them
// twice for an app that checks every declaration file.

/** Svelte's environment flags. */
declare module "esm-env" {
	/** `true` on the background thread; `false` on the main thread, which draws the first frame. */
	export const BROWSER: boolean;
	/** `true` in a development build. */
	export const DEV: boolean;
	/** `false`: Lynx is not Node. */
	export const NODE: boolean;
}

/**
 * `import "background-only"` keeps a module off the main thread: there it is a stub, and using it
 * while the first frame renders throws. Use what it exports in `onMount`, `$effect` or event
 * handlers, which run on the background thread.
 */
declare module "background-only" {}
