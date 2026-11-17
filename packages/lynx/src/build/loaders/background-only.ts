// Runs last on every main-thread script (`enforce: 'post'`), `node_modules` included: a module
// without the marker is answered at once, and Svelte's own source is never read.

import type { Rspack } from "@rsbuild/core";

import type { InputMap } from "../source-map/maps.ts";
import { backgroundOnlyStub } from "./background-only-stub.ts";
import { isSvelteSource } from "./svelte-skip.ts";

/** What the plugin tells the loader. */
export interface BackgroundOnlyLoaderOptions {
	/** The file `background-only` resolves to. */
	marker: string;
}

export default function backgroundOnlyLoader(
	this: Rspack.LoaderContext<BackgroundOnlyLoaderOptions>,
	source: string,
	map?: InputMap,
): void {
	this.cacheable(true);
	// Boundary: the bundler types a source map by its own shape.
	const unchanged = (map ?? undefined) as Rspack.sources.RawSourceMap | undefined;
	if (!source.includes("background-only") || isSvelteSource(this.resourcePath)) {
		this.callback(null, source, unchanged);
		return;
	}
	const callback = this.async();
	backgroundOnlyStub({
		source,
		resourcePath: this.resourcePath,
		rootContext: this.rootContext,
		marker: this.getOptions().marker,
	}).then(
		// Rspack does not chain a loader's map: one that returns none ends the chain, and every
		// main-thread script lost the map of the loaders before it. The module as it was keeps
		// their map; a stub is not the source.
		(code) => callback(null, code, code === source ? unchanged : undefined),
		(error: unknown) => callback(error as Error),
	);
}
