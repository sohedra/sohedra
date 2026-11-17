// Gives a component's CSS, compiled by the component's loader and kept in the build's store, for
// an import like
//
//   import "./Card.svelte.css!=!<this loader>?css=<key>!./Card.svelte";
//
// The `.css` match resource sends the result through the normal CSS rules, which put it in the
// Lynx template; the `.svelte` file itself is ignored. The key is a short hash of the CSS.

import type { Rspack } from "@rsbuild/core";

import { buildError } from "../diagnostics/messages.ts";
import { readCss } from "./css-store.ts";

export default function svelteCssLoader(this: Rspack.LoaderContext<{ css: string }>): string {
	const css = readCss(this, this.getOptions().css);
	if (css === undefined) {
		// A cache restored the component's code without running its loader.
		throw buildError({ code: "css_not_stored", details: { file: this.resourcePath } });
	}
	return css;
}
