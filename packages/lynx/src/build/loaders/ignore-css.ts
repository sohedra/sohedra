// The main thread's copy of a CSS file: the background layer's copy carries the CSS into the
// template, so the main thread's is dropped here. A CSS Module keeps its class-name map, which the
// first frame renders.

import type { Rspack } from "@rsbuild/core";

export default function ignoreCssLoader(this: Rspack.LoaderContext, source: string): string {
	this.cacheable(true);
	// css-loader with `exportOnlyLocals` emits no `___CSS_LOADER_EXPORT___` for a CSS Module, so its
	// presence means plain CSS. An ES module, so the importing module stays strict.
	if (source.includes("___CSS_LOADER_EXPORT___")) return "export {}";
	return source;
}
