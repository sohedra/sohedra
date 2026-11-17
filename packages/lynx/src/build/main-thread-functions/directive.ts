// What marks a function as a main-thread function, and the shapes of code around it.

import type { Node } from "./node.ts";

// Both spellings of the directive.
const DIRECTIVE = /(['"])main[ -]thread\1/;
const isDirective = (value: unknown): boolean => value === "main thread" || value === "main-thread";

/** A quick check that skips most files: whether `source` has the directive's text at all. */
export const hasMainThreadFunction = (source: string): boolean => DIRECTIVE.test(source);

/** The nodes that are functions. */
export const FUNCTIONS: Set<string> = new Set([
	"FunctionDeclaration",
	"FunctionExpression",
	"ArrowFunctionExpression",
]);

/** TypeScript's wrappers around an expression: `x as T`, `x satisfies T`, `x!`, `<T>x`, `f<T>`. */
export const TYPE_WRAPPERS: Set<string> = new Set([
	"TSAsExpression",
	"TSSatisfiesExpression",
	"TSNonNullExpression",
	"TSTypeAssertion",
	"TSInstantiationExpression",
]);

/** The expression inside any TypeScript wrappers. */
export const unwrap = (node: Node): Node => {
	while (node && TYPE_WRAPPERS.has(node.type)) node = node.expression;
	return node;
};

/** Whether `node` is a function whose body starts with the directive. */
export function isMainThreadFunction(node: Node): boolean {
	if (!FUNCTIONS.has(node?.type) || node.body?.type !== "BlockStatement") return false;
	const first = node.body.body[0];
	return (
		first?.type === "ExpressionStatement" &&
		first.expression.type === "Literal" &&
		isDirective(first.expression.value)
	);
}

/** The names a binding pattern declares. */
export function patternNames(node: Node, names: Set<string> = new Set()): Set<string> {
	switch (node?.type) {
		case "Identifier":
			names.add(node.name);
			break;
		case "ObjectPattern":
			for (const property of node.properties)
				patternNames(property.type === "RestElement" ? property.argument : property.value, names);
			break;
		case "ArrayPattern":
			for (const element of node.elements) patternNames(element, names);
			break;
		case "RestElement":
			patternNames(node.argument, names);
			break;
		case "AssignmentPattern":
			patternNames(node.left, names);
			break;
		case "TSParameterProperty":
			patternNames(node.parameter, names);
			break;
	}
	return names;
}
