// Rewrites the two regexes of Svelte's own text that Lynx's main-thread engine refuses (see
// `rewritePrimjsRegex`). The rule that runs this matches those two files only.

import type { Rspack } from "@rsbuild/core";

import { rewritePrimjsRegex } from "../../svelte/build/index.ts";
import { buildWarning } from "../diagnostics/messages.ts";

export default function primjsRegexLoader(this: Rspack.LoaderContext, source: string): string {
	this.cacheable(true);
	const result = rewritePrimjsRegex(source, this.resourcePath);
	if (result === undefined) return source;
	if (typeof result === "string") return result;
	// Svelte's file is not what the build expected: the engine may refuse it, which is no reason to stop the build.
	const { message } = buildWarning({
		code: "primjs_regex_moved",
		details: { file: this.resourcePath, name: result.missing },
	});
	this.emitWarning(Object.assign(new Error(message), { stack: "" }));
	return source;
}
