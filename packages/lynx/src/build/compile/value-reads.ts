// Which imported names a module or a component reads as values: the names the main thread's copy
// keeps, so that the bundler keeps the modules they come from.

import { field, identifierName } from "../../svelte/build/index.ts";
import type { AnyNode } from "../../svelte/build/index.ts";

/** TypeScript's wrappers around a value: only their `expression` is read. */
const VALUE_WRAPPERS = new Set([
	"TSAsExpression",
	"TSSatisfiesExpression",
	"TSNonNullExpression",
	"TSTypeAssertion",
	"TSInstantiationExpression",
]);

/** Keys that hold types, on any node: an annotation, a return type, type parameters or arguments. */
const TYPE_KEYS = new Set([
	"typeAnnotation",
	"returnType",
	"typeParameters",
	"typeArguments",
	"superTypeParameters",
	"superTypeArguments",
	"implements",
]);

/** A key that is not a read: a member's or a property's name, unless it is computed. */
function isNameKey(node: AnyNode, key: string): boolean {
	if (node.computed === true) return false;
	if (node.type === "MemberExpression") return key === "property";
	return (
		key === "key" &&
		(node.type === "Property" ||
			node.type === "MethodDefinition" ||
			node.type === "PropertyDefinition" ||
			node.type === "AccessorProperty")
	);
}

/** The names `node` reads as values, written into `names`. */
function read(node: unknown, names: Set<string>): void {
	if (!node || typeof node !== "object") return;
	if (Array.isArray(node)) {
		for (const child of node) read(child, names);
		return;
	}
	// Boundary: the AST's nodes are read by shape.
	const record = node as AnyNode;
	const type = typeof record.type === "string" ? record.type : "";
	if (type.startsWith("TS")) {
		if (VALUE_WRAPPERS.has(type)) read(field(record, "expression"), names);
		return;
	}
	// An import names, and a label or `import.meta` reads nothing; a re-export reads another module.
	if (
		type === "ImportDeclaration" ||
		type === "LabeledStatement" ||
		type === "BreakStatement" ||
		type === "ContinueStatement" ||
		type === "MetaProperty"
	) {
		if (type === "LabeledStatement") read(field(record, "body"), names);
		return;
	}
	if ((type === "ExportNamedDeclaration" || type === "ExportAllDeclaration") && record.source)
		return;
	// `export type { Shape }`, `export { type Sized }`: a type's name, never read.
	if (
		(type === "ExportNamedDeclaration" || type === "ExportSpecifier") &&
		record.exportKind === "type"
	)
		return;
	if (type === "ExportSpecifier") {
		read(field(record, "local"), names);
		return;
	}
	if (type === "Identifier") {
		const name = identifierName(record);
		if (name !== undefined) names.add(name);
		return;
	}
	// An action's name is its dotted path, as text: `use:tooltip.show` reads `tooltip`.
	if (type === "UseDirective") names.add(String(record.name).split(".")[0]!);
	for (const key of Object.keys(record)) {
		if (key === "parent" || key === "metadata" || TYPE_KEYS.has(key)) continue;
		if (isNameKey(record, key)) continue;
		read(record[key], names);
	}
}

/**
 * The names `programs` import as values (not `import type`, nor `{ type X }`) that `code` reads as
 * values: never only as a type (`x as Shape`, `x: Shape`, `satisfies Shape`, `f<Shape>()`) or a
 * property's name (`x.Shape`, `{ Shape: 1 }`). TypeScript lets a type be imported without `type`,
 * and a name kept from such an import would ask the bundler for an export that does not exist.
 */
export function importedValueReads(
	programs: readonly AnyNode[],
	code: readonly unknown[],
): string[] {
	const imported = new Set<string>();
	for (const program of programs) {
		// Boundary: the program's statements are read by shape.
		for (const statement of (program.body ?? []) as AnyNode[]) {
			if (statement.type !== "ImportDeclaration" || statement.importKind === "type") continue;
			// Boundary: the node is read by shape; a declaration's specifiers are nodes.
			for (const specifier of (statement.specifiers ?? []) as AnyNode[]) {
				const name = identifierName(field(specifier, "local"));
				if (name !== undefined && specifier.importKind !== "type") imported.add(name);
			}
		}
	}
	const reads = new Set<string>();
	for (const node of code) read(node, reads);
	return [...reads].filter((name) => imported.has(name));
}
