// Patches Svelte's client `props.js` (see `patchSpreadSetter`). The rule that runs this matches
// that file only.

import type { Rspack } from "@rsbuild/core";

import { patchSpreadSetter } from "../../svelte/build/index.ts";
import { buildError } from "../diagnostics/messages.ts";

export default function svelteSpreadSetterLoader(
	this: Rspack.LoaderContext,
	source: string,
): string {
	this.cacheable(true);
	const result = patchSpreadSetter(source);
	if ("missing" in result) {
		throw buildError({
			code: "spread_setter_moved",
			details: { file: this.resourcePath, anchor: result.missing },
		});
	}
	return result.code;
}
