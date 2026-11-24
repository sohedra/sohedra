// The names a script declares, and the globals a member read names, for the walk of the app's
// scripts (script-uses.ts).

import {
	isMainThreadFunction,
	patternNames,
	TYPE_WRAPPERS,
} from "../main-thread-functions/directive.ts";
import type { Node } from "../main-thread-functions/node.ts";

/** What a declared name is, for a call from a main-thread function. */
export type Declared = "plain-function" | "value";

/** Keys that hold types, comments or positions, not code. */
export const SKIPPED_KEYS: ReadonlySet<string> = new Set([
	"loc",
	"leadingComments",
	"trailingComments",
	"typeAnnotation",
	"returnType",
	"typeParameters",
	"typeArguments",
	"superTypeParameters",
	"superTypeArguments",
	"implements",
	"metadata",
	"parent",
]);

export const FUNCTIONS: ReadonlySet<string> = new Set([
	"FunctionDeclaration",
	"FunctionExpression",
	"ArrowFunctionExpression",
]);
/** The objects a global is read from as a member, which a check reads as a feature check. */
export const GLOBAL_OBJECTS: ReadonlySet<string> = new Set([
	"globalThis",
	"window",
	"self",
	"global",
]);

/** What a declaration with this value declares, for a call from a main-thread function. */
function declaredAs(value: Node): Declared {
	let init = value;
	while (init && TYPE_WRAPPERS.has(init.type)) init = init.expression;
	return FUNCTIONS.has(init?.type) && !isMainThreadFunction(init) ? "plain-function" : "value";
}

/**
 * Adds to `names` every name declared in `node`, outside nested functions: variables, functions,
 * classes, imports, enums, a `catch`'s parameter.
 */
export function collect(node: Node, names: Map<string, Declared>): void {
	if (!node || typeof node !== "object") return;
	if (Array.isArray(node)) {
		for (const item of node) collect(item, names);
		return;
	}
	switch (node.type) {
		case "VariableDeclarator":
			for (const name of patternNames(node.id)) names.set(name, "value");
			if (node.id?.type === "Identifier" && node.init)
				names.set(node.id.name, declaredAs(node.init));
			break;
		case "FunctionDeclaration":
			if (node.id) names.set(node.id.name, declaredAs(node));
			return;
		case "FunctionExpression":
		case "ArrowFunctionExpression":
			return;
		case "ClassDeclaration":
		case "TSEnumDeclaration":
		case "TSModuleDeclaration":
		case "TSImportEqualsDeclaration":
			if (node.id?.type === "Identifier") names.set(node.id.name, "value");
			break;
		case "ImportSpecifier":
		case "ImportDefaultSpecifier":
		case "ImportNamespaceSpecifier":
			names.set(node.local.name, "value");
			return;
		case "CatchClause":
			for (const name of patternNames(node.param)) names.set(name, "value");
			break;
	}
	for (const key of Object.keys(node)) if (!SKIPPED_KEYS.has(key)) collect(node[key], names);
}

/**
 * The global `X` a member read `globalThis.X` (or `window.X`, `self.X`) names, or `lynx.X` for a
 * member of `lynx`; `undefined` for any other node.
 */
export function memberOfGlobal(node: Node): string | undefined {
	if (node?.type !== "MemberExpression" || node.computed) return undefined;
	if (node.object?.type !== "Identifier" || node.property?.type !== "Identifier") return undefined;
	if (node.object.name === "lynx") return `lynx.${node.property.name}`;
	return GLOBAL_OBJECTS.has(node.object.name) ? node.property.name : undefined;
}

/** The name `X` a member `globalThis.X` (or `globalThis["X"]`, `self.X`, `window.X`) names. */
export function globalMemberName(node: Node): string | undefined {
	if (node?.type !== "MemberExpression" || node.object?.type !== "Identifier") return undefined;
	if (!GLOBAL_OBJECTS.has(node.object.name)) return undefined;
	if (!node.computed && node.property?.type === "Identifier") return node.property.name;
	return node.computed && typeof node.property?.value === "string"
		? node.property.value
		: undefined;
}
