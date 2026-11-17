// A walk over Svelte's template AST, for the code that looks for nodes in a component before it
// compiles: bare attributes, event attributes, list items, imports in effects.

import type { ComponentAst } from "./compiler.ts";

/** A script's program: Svelte gives it positions in the whole component, which its type leaves out. */
export interface ScriptProgram {
	type: "Program";
	start: number;
	end: number;
	body: unknown[];
	[key: string]: unknown;
}

/** The program of a component's `<script>`, with its positions, or `undefined` when it has none. */
export function scriptProgram(script: ComponentAst["instance"]): ScriptProgram | undefined {
	// Boundary: Svelte types the program without the positions it gives it.
	return script ? (script.content as unknown as ScriptProgram) : undefined;
}

/** The attributes of `<svelte:options>`. */
export function optionAttributes(ast: ComponentAst): AnyNode[] {
	// Boundary: the AST's node types are read by shape.
	return (ast.options?.attributes ?? []) as unknown as AnyNode[];
}

/** A node of Svelte's AST, read generically. */
export interface AnyNode {
	type?: unknown;
	start?: number;
	end?: number;
	[key: string]: unknown;
}

/**
 * Every object in `node`'s tree, depth first, each before its children (in the order of its
 * keys). `parent` and `metadata` are skipped: they point back up the tree or hold the compiler's
 * analysis.
 */
export function* nodes(node: unknown): Generator<AnyNode> {
	if (!node || typeof node !== "object") return;
	if (Array.isArray(node)) {
		for (const child of node) yield* nodes(child);
		return;
	}
	// Boundary: the AST's node types are read by shape.
	const record = node as AnyNode;
	yield record;
	for (const key of Object.keys(record)) {
		if (key === "parent" || key === "metadata") continue;
		yield* nodes(record[key]);
	}
}
