// The Svelte compiler of the app being built, not of this package's own folder, so the compiler
// always matches the runtime the app bundles.

import { createRequire } from "node:module";
import path from "node:path";

import type * as Compiler from "svelte/compiler";
import type { AST } from "svelte/compiler";

export type { AST, CompileOptions, ModuleCompileOptions, PreprocessorGroup } from "svelte/compiler";

/** Svelte's compiler, as the module `svelte/compiler`. */
export type SvelteCompiler = typeof Compiler;

/** A component's template and scripts, parsed in the modern form with positions. */
export type ComponentAst = AST.Root;

/** The Svelte compiler of the app in `root`. */
export function svelteCompiler(root: string): SvelteCompiler {
	// Boundary: a module loaded by name has no type here.
	// Boundary: a module loaded by name has no type; this one is Svelte's compiler.
	return createRequire(path.join(root, "package.json"))("svelte/compiler") as SvelteCompiler;
}
