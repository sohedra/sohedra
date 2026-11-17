// Compiles `.svelte.js` and `.svelte.ts` rune modules.
//
// Runs after a TypeScript-only pass (which keeps class fields as fields, `useDefineForClassFields:
// true`, so the compiler still sees `count = $state(0)` in a class body) and before the layer's
// lowering.

import type { Rspack } from "@rsbuild/core";

import type { ModuleCompileOptions } from "../../svelte/build/index.ts";
import type { Thread } from "../../wire/index.ts";
import { compileRuneModule } from "../compile/rune-module.ts";
import type { InputMap } from "../source-map/maps.ts";

/** What the plugin tells the rune-module loader. */
export interface SvelteModuleLoaderOptions {
	thread: Thread;
	compilerOptions?: ModuleCompileOptions;
}

export default function svelteModuleLoader(
	this: Rspack.LoaderContext<SvelteModuleLoaderOptions>,
	source: string,
	map?: InputMap,
): void {
	const { thread, compilerOptions } = this.getOptions();
	let result;
	try {
		result = compileRuneModule(source, {
			filename: this.resourcePath,
			thread,
			root: this.rootContext,
			development: this.mode === "development",
			sourceMap: this.sourceMap,
			compilerOptions,
			inputMap: map,
		});
	} catch (error) {
		// Boundary: the bundler's callback takes an `Error`; a thrown value is any.
		this.callback(error as Error);
		return;
	}
	for (const warning of result.warnings) {
		const reported = new Error(warning.message);
		reported.name = "SvelteWarning";
		reported.stack = "";
		this.emitWarning(reported);
	}
	// Boundary: the bundler types a source map by its own shape.
	this.callback(null, result.code, result.map as Rspack.sources.RawSourceMap | undefined);
}
