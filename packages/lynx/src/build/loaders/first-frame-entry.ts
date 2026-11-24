// The main thread's copy of a page's entry, for the first frame: imports the entry named in the
// resource query, as written in the app's config (the bundler resolves it from the app's folder).
// Going through this module puts the entry's own imports in the main-thread bundler layer's
// resolution (an entry module itself has no issuer, so layer rules would not apply to it).
//
// An entry that does not draw its first frame (`firstFrame` as a function of the entry's name)
// says `firstFrame=off` in the query: the page's `mountPage` has recorded how to draw it by the
// time the entry's imports have loaded, and this takes that record away. Nothing is drawn, as with
// `firstFrame: false`; the page's imports still load, as there.

import type { Rspack } from "@rsbuild/core";

import { FIRST_FRAME_GLOBAL } from "../../wire/index.ts";
import { stringLiteral } from "../string-literal.ts";

export default function firstFrameEntryLoader(this: Rspack.LoaderContext<unknown>): string {
	const query = new URLSearchParams(this.resourceQuery.slice(1));
	const off = query.get("firstFrame") === "off";
	return (
		`import ${stringLiteral(query.get("entry") ?? "")};\n` +
		(off ? `delete globalThis[${stringLiteral(FIRST_FRAME_GLOBAL)}];\n` : "")
	);
}
