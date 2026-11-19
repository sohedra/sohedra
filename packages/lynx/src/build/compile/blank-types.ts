// A component's text with its TypeScript blanked out: each type, and what only types use, becomes
// spaces, so every other character keeps its place (and the maps made against the text as written
// still hold). The main thread's copy of a component ends with its main-thread functions copied
// from this text, so that Svelte's output and the functions are JavaScript, read as such:
// TypeScript reads some JavaScript otherwise (`` a < b > `0` `` is a call there).
//
// It blanks what Svelte itself strips from a component's scripts, the TypeScript that only types:
// annotations, `as`, `satisfies`, `!`, type parameters and arguments, `this` parameters, optional and
// definite marks, and declarations of types. Svelte refuses the rest (an `enum`, a parameter property).

import type { AnyNode } from "../../svelte/build/index.ts";

/** Wrappers whose `expression` is the value, by the keyword their type follows. */
const KEYWORDS: Readonly<Record<string, string>> = {
	TSAsExpression: "as",
	TSSatisfiesExpression: "satisfies",
};

/** Nodes whose whole text is a type or a declaration of one. */
const WHOLE = new Set([
	"TSTypeAnnotation",
	"TSTypeParameterDeclaration",
	"TSTypeParameterInstantiation",
	"TSInterfaceDeclaration",
	"TSTypeAliasDeclaration",
	"TSDeclareFunction",
]);

/** The function nodes, whose `this` parameter is TypeScript's only. */
const FUNCTIONS = new Set(["FunctionDeclaration", "FunctionExpression", "ArrowFunctionExpression"]);

/** The ranges of `node`'s tree in `source` that are TypeScript only, written into `ranges`. */
function collect(source: string, node: unknown, ranges: [number, number][]): void {
	if (!node || typeof node !== "object") return;
	if (Array.isArray(node)) {
		for (const child of node) collect(source, child, ranges);
		return;
	}
	// Boundary: the AST's nodes are read by shape.
	const record = node as AnyNode & { start?: number; end?: number };
	const { type, start, end } = record;
	if (typeof type === "string" && typeof start === "number" && typeof end === "number") {
		if (WHOLE.has(type) || (type === "ExportNamedDeclaration" && record.exportKind === "type")) {
			ranges.push([start, end]);
			return;
		}
		if (type === "TSTypeAssertion") {
			// `<T>value`: the type, before the value.
			const expression = record.expression as AnyNode;
			ranges.push([start, expression.start as number]);
		} else if (type === "TSNonNullExpression") {
			// `value!`: the mark is the last character, after any parenthesis around the value.
			ranges.push([end - 1, end]);
		} else if (KEYWORDS[type] !== undefined) {
			// `value as T`, `(value) satisfies T`: from the keyword on.
			const annotation = record.typeAnnotation as AnyNode;
			ranges.push([source.lastIndexOf(KEYWORDS[type], annotation.start as number), end]);
		} else if (type === "Identifier") {
			// `x?: T`, `x!: T`, `x?`: the mark after the name, with the annotation.
			const nameEnd = start + String(record.name).length;
			if (record.optional === true || record.typeAnnotation) ranges.push([nameEnd, end]);
			return;
		} else if (FUNCTIONS.has(type)) {
			// Boundary: a function's parameters are nodes.
			const [first, second] = (record.params ?? []) as AnyNode[];
			if (first?.type === "Identifier" && first.name === "this")
				ranges.push([first.start as number, (second?.start ?? first.end) as number]);
		}
	}
	for (const key of Object.keys(record)) {
		if (key === "parent" || key === "metadata") continue;
		collect(source, record[key], ranges);
	}
}

/**
 * `source` with the TypeScript of the trees `nodes` (a component's scripts and markup, positioned in
 * `source`) replaced by spaces; line breaks stay.
 */
export function blankTypes(source: string, nodes: readonly unknown[]): string {
	const ranges: [number, number][] = [];
	collect(source, nodes, ranges);
	if (ranges.length === 0) return source;
	// Code units, as the positions count them.
	const text = source.split("");
	for (const [from, to] of ranges)
		for (let index = from; index < to; index++) if (text[index] !== "\n") text[index] = " ";
	return text.join("");
}
