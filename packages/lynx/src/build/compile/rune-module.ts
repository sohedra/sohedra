// Compiles one `.svelte.js` or `.svelte.ts` rune module, for the thread of its copy. The module
// arrives already stripped of its types by a TypeScript-only pass that keeps class fields as
// fields (`useDefineForClassFields: true`), so the compiler still sees `count = $state(0)` in a
// class body.

import type { ModuleCompileOptions } from "../../svelte/build/index.ts";
import { svelteCompiler } from "../../svelte/build/index.ts";
import type { Thread } from "../../wire/index.ts";
import type { BuildWarning } from "../diagnostics/messages.ts";
import { compileError, compileWarnings } from "../diagnostics/svelte-errors.ts";
import { compose } from "../source-map/maps.ts";
import type { InputMap, SourceMap } from "../source-map/maps.ts";

/** What compiling a rune module reads. */
export interface ModuleOptions {
	filename: string;
	/** The thread: the main thread's copy compiles for Svelte's server renderer (the first frame). */
	thread: Thread;
	root: string;
	development: boolean;
	/** Whether to give a source map. */
	sourceMap: boolean;
	compilerOptions?: ModuleCompileOptions | undefined;
	/** The map of the pass that stripped the module's types. */
	inputMap?: InputMap;
}

/** A compiled rune module. */
export interface CompiledModule {
	code: string;
	map: SourceMap | undefined;
	/** Svelte's warnings, once: only the background thread's copy reports them. */
	warnings: BuildWarning[];
}

/** Compile the module in `source`. A compile error is thrown as the build's message. */
export function compileRuneModule(source: string, options: ModuleOptions): CompiledModule {
	const { filename, thread } = options;
	const { compileModule } = svelteCompiler(options.root);
	const text = { source: { file: filename, text: source }, locate: (offset: number) => offset };
	let result;
	try {
		result = compileModule(source, {
			...options.compilerOptions,
			filename,
			generate: thread === "main-thread" ? "server" : "client",
			dev: options.development,
		});
	} catch (error) {
		throw compileError(error, text);
	}
	// `compileModule` takes no input map: compose it with the TypeScript pass's.
	// Boundary: Svelte's map is a source map, typed loosely.
	const map = result.js.map as SourceMap;
	return {
		code: result.js.code,
		map: options.sourceMap ? compose(map, options.inputMap) : undefined,
		// The background's compile reports them; the main thread's copy has the same.
		warnings: thread === "main-thread" ? [] : compileWarnings(result.warnings, text),
	};
}
