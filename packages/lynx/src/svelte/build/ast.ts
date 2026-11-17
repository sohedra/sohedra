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

/** A node of Svelte's AST, read generically. */
export interface AnyNode {
	type?: unknown;
	start?: number;
	end?: number;
	[key: string]: unknown;
}

/** The attributes of `<svelte:options>`. */
export function optionAttributes(ast: ComponentAst): AnyNode[] {
	// Boundary: Svelte's node types are narrower than the shapes the build reads them by.
	return (ast.options?.attributes ?? []) as unknown as AnyNode[];
}

/** The attributes of an element node (`RegularElement`, `SvelteElement`). */
export function attributesOf(element: AnyNode): AnyNode[] {
	// Boundary: the node is read by shape; every element has this list.
	return element.attributes as AnyNode[];
}

/** An attribute's name, with any `main-thread:` prefix. A spread or an attachment has none: check the type first. */
export function attributeName(attribute: AnyNode): string {
	// Boundary: the node is read by shape; an `Attribute` and a directive have a string name.
	return attribute.name as string;
}

/**
 * An attribute's value: `true` for a bare attribute, otherwise the list of its parts (one
 * `ExpressionTag` for `{x}`, `Text` and tags for a quoted value).
 */
export function attributeValue(attribute: AnyNode): AnyNode[] | true {
	// Boundary: Svelte gives one node or a list, by how the value is written.
	const value = attribute.value as AnyNode | AnyNode[] | true;
	return value === true || Array.isArray(value) ? value : [value];
}

/** The child node under `key`, such as a call's `callee` or an `{#each}` block's `key`. */
export function field(node: AnyNode, key: string): AnyNode | undefined {
	// Boundary: the node is read by shape; the caller names a field that holds a node.
	return node[key] as AnyNode | undefined;
}

/** The nodes of a block's body, such as an `{#each}` block's. */
export function bodyNodes(block: AnyNode): AnyNode[] {
	// Boundary: the node is read by shape; a block's body is a fragment of nodes.
	return (field(block, "body")?.nodes ?? []) as AnyNode[];
}

/** The name of an `Identifier` node, or `undefined` for any other node. */
export function identifierName(node: AnyNode | undefined): string | undefined {
	// Boundary: the node is read by shape; an identifier's name is a string.
	return node?.type === "Identifier" ? (node.name as string) : undefined;
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
	// Boundary: the AST's nodes are read by shape; this is the walk's one view of them.
	const record = node as AnyNode;
	yield record;
	for (const key of Object.keys(record)) {
		if (key === "parent" || key === "metadata") continue;
		yield* nodes(record[key]);
	}
}
