// Where a component's CSS waits between the two loaders that handle it (the component's loader
// compiles it, the CSS loader gives it to the CSS rules). The import that connects them carries a
// key, not the CSS: the bundler names a module after its request, and an 8 KB `<style>` block made
// a name the engine refuses ("identifier too long").
//
// One store for each compiler, so two builds in one process (two environments, a dev server and a
// test) never read each other's CSS.

import { createHash } from "node:crypto";

const stores = new WeakMap<object, Map<string, string>>();

/** What the loaders know of a build: its compiler (Rspack's `_compiler`). */
export interface CssStoreContext {
	_compiler?: object | undefined;
	resourcePath: string;
}

function storeOf(context: CssStoreContext): Map<string, string> {
	// A loader run outside a build (no compiler) has one store of its own.
	const owner = context._compiler ?? context;
	let store = stores.get(owner);
	if (store === undefined) stores.set(owner, (store = new Map()));
	return store;
}

const keyOf = (file: string, hash: string): string => `${file}\0${hash}`;

/**
 * Keep `css` for the component's CSS loader; returns the key the import carries: a short hash of
 * the CSS.
 *
 * @workaround short-css-import kind=lynx-limit delete-when="the engine accepts an identifier as long as a component's CSS"
 */
export function storeCss(context: CssStoreContext, css: string): string {
	const hash = createHash("sha256").update(css).digest("hex").slice(0, 12);
	storeOf(context).set(keyOf(context.resourcePath, hash), css);
	return hash;
}

/** The CSS kept for the component and key, or `undefined`. */
export function readCss(context: CssStoreContext, hash: string): string | undefined {
	return storeOf(context).get(keyOf(context.resourcePath, hash));
}
