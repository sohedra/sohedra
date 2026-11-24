// Where a component's CSS waits between the two loaders that handle it (the component's loader
// compiles it, the CSS loader gives it to the CSS rules). The import that connects them carries a
// key, not the CSS: the bundler names a module after its request, and an 8 KB `<style>` block made
// a name the engine refuses ("identifier too long").
//
// One store for each compiler, so two builds in one process (two environments, a dev server and a
// test) never read each other's CSS. It holds each component's newest CSS only: a dev server's
// compiler lives as long as the session, and every change to a component's styles is a new key.

import { createHash } from "node:crypto";

/** Each component's newest CSS, by its file: the key its import carries, and the CSS. */
type Store = Map<string, { hash: string; css: string }>;

const stores = new WeakMap<object, Store>();

/** What the loaders know of a build: its compiler (Rspack's `_compiler`). */
interface CssStoreContext {
	_compiler?: object | undefined;
	resourcePath: string;
}

function storeOf(context: CssStoreContext): Store {
	// A loader run outside a build (no compiler) has one store of its own.
	const owner = context._compiler ?? context;
	let store = stores.get(owner);
	if (store === undefined) stores.set(owner, (store = new Map()));
	return store;
}

/**
 * Keep `css` for the component's CSS loader, in place of the component's CSS before; returns the
 * key the import carries: a short hash of the CSS.
 *
 * @workaround short-css-import kind=lynx-limit delete-when="the engine accepts an identifier as long as a component's CSS"
 */
export function storeCss(context: CssStoreContext, css: string): string {
	const hash = createHash("sha256").update(css).digest("hex").slice(0, 12);
	storeOf(context).set(context.resourcePath, { hash, css });
	return hash;
}

/** The CSS kept for the component and key, or `undefined`: none, or the component's CSS changed since. */
export function readCss(context: CssStoreContext, hash: string): string | undefined {
	const kept = storeOf(context).get(context.resourcePath);
	return kept?.hash === hash ? kept.css : undefined;
}
