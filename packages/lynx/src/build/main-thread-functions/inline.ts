// A main-thread function written anywhere in the markup: in a `main-thread:` attribute, a
// component's prop, a spread, a `{@const}`, an argument of `{@render}`:
//
//   <view main-thread:ontap={(event) => { 'main thread'; ... }}>
//   <Pan onMove={(event) => { 'main thread'; ... }} />
//
// is declared in the instance script as `const __mainThread0 = ...` instead, and the markup keeps
// the name, so it is compiled like any other. The same text gives the same names on both threads,
// so the ids still agree. A function that uses a name that exists only where it is written (an
// `{#each}` item, a snippet's parameter, a parameter of a function around it) cannot move, and is
// an error.

import type { ComponentAst } from "../../svelte/build/index.ts";
import { FUNCTIONS, isMainThreadFunction, patternNames } from "./directive.ts";
import type { Node } from "./node.ts";

const TYPE_KEYS = new Set(["typeAnnotation", "returnType", "typeParameters", "typeArguments"]);
/** Keys of the template's nodes that are not its children. */
const SKIPPED_KEYS = new Set(["parent", "metadata", "loc", "leadingComments", "trailingComments"]);

/** The prefix a directive is written with, by its node's type. */
const DIRECTIVES: Record<string, string> = {
	BindDirective: "bind",
	ClassDirective: "class",
	StyleDirective: "style",
	UseDirective: "use",
	OnDirective: "on",
	LetDirective: "let",
	AnimateDirective: "animate",
};
/** How a tag or block is written, by its node's type. */
const TAGS: Record<string, string> = {
	ExpressionTag: "{…}",
	RenderTag: "{@render …}",
	ConstTag: "{@const …}",
	AttachTag: "{@attach …}",
	HtmlTag: "{@html …}",
	IfBlock: "{#if …}",
	EachBlock: "{#each …}",
	AwaitBlock: "{#await …}",
	KeyBlock: "{#key …}",
};

/** Identifiers a function reads that it does not declare itself (closely enough to name them in an error). */
function freeNames(fn: Node): string[] {
	const declared = new Set<string>();
	const used = new Set<string>();
	const visit = (node: Node, parentKey?: string, parent?: Node): void => {
		if (!node || typeof node.type !== "string") return;
		if (node.type === "Identifier") {
			const isKey =
				(parent?.type === "MemberExpression" && parentKey === "property" && !parent.computed) ||
				(parent?.type === "Property" &&
					parentKey === "key" &&
					!parent.computed &&
					!parent.shorthand);
			if (!isKey) used.add(node.name);
			return;
		}
		if (node.type.endsWith("FunctionExpression") || node.type === "FunctionDeclaration") {
			for (const param of node.params) patternNames(param).forEach((name) => declared.add(name));
			if (node.id) declared.add(node.id.name);
		} else if (node.type === "VariableDeclarator") {
			patternNames(node.id).forEach((name) => declared.add(name));
		} else if (node.type === "CatchClause" && node.param) {
			patternNames(node.param).forEach((name) => declared.add(name));
		}
		for (const key in node) {
			if (TYPE_KEYS.has(key) || key === "loc") continue;
			const child = node[key];
			if (Array.isArray(child)) for (const item of child) visit(item, key, node);
			else if (child && typeof child === "object") visit(child, key, node);
		}
	};
	visit(fn);
	return [...used].filter((name) => !declared.has(name));
}

/** The names a function written in the markup declares: its parameters, and its body's declarations. */
function localNames(fn: Node): Set<string> {
	const names = new Set<string>();
	if (fn.id) names.add(fn.id.name);
	for (const param of fn.params) patternNames(param, names);
	const visit = (node: Node): void => {
		if (!node || typeof node.type !== "string" || FUNCTIONS.has(node.type)) return;
		if (node.type === "VariableDeclarator") patternNames(node.id, names);
		if (node.type === "CatchClause") patternNames(node.param, names);
		for (const key in node) {
			const child = node[key];
			if (Array.isArray(child)) for (const item of child) visit(item);
			else if (child && typeof child === "object" && key !== "loc") visit(child);
		}
	};
	if (fn.body.type === "BlockStatement") for (const statement of fn.body.body) visit(statement);
	return names;
}

/** A main-thread function written in the markup. */
export interface InlineFunction {
	/** Where it is written, as the developer reads it: the attribute, `{...}` for a spread, or the tag. */
	where: string;
	/** The function. */
	expression: Node;
	/** The names that exist only where it is written: `{#each}` items, snippet parameters, `{@const}`. */
	blockNames: string[];
}

/** How an attribute or directive is written. */
function attributeLabel(node: Node): string | undefined {
	if (node.type === "Attribute") return node.name;
	if (node.type === "SpreadAttribute") return "{...}";
	if (node.type === "TransitionDirective")
		return `${node.intro && node.outro ? "transition" : node.intro ? "in" : "out"}:${node.name}`;
	const prefix = DIRECTIVES[node.type];
	return prefix === undefined ? undefined : `${prefix}:${node.name}`;
}

/** The main-thread functions of the markup, outermost only, in source order. */
export function inlineFunctions(ast: ComponentAst): InlineFunction[] {
	const found: InlineFunction[] = [];
	const withNames = (scope: Set<string>, ...patterns: Node[]): Set<string> => {
		const next = new Set(scope);
		for (const pattern of patterns) {
			if (typeof pattern === "string") next.add(pattern);
			else patternNames(pattern, next);
		}
		return next;
	};
	const visitFragment = (fragment: Node, scope: Set<string>): void => {
		if (!fragment?.nodes) return;
		const local = new Set(scope);
		for (const node of fragment.nodes) {
			if (node.type === "ConstTag")
				for (const declarator of node.declaration.declarations) patternNames(declarator.id, local);
		}
		for (const node of fragment.nodes) visit(node, local, TAGS[node.type] ?? "{…}");
	};
	const visitChildren = (node: Node, scope: Set<string>, where: string): void => {
		for (const key in node) {
			if (SKIPPED_KEYS.has(key)) continue;
			const child = node[key];
			if (Array.isArray(child)) for (const item of child) visit(item, scope, where);
			else if (child && typeof child === "object") visit(child, scope, where);
		}
	};
	const visit = (node: Node, scope: Set<string>, where: string): void => {
		if (!node || typeof node.type !== "string") return;
		switch (node.type) {
			case "Fragment":
				visitFragment(node, scope);
				return;
			case "EachBlock": {
				visit(node.expression, scope, where);
				const inside = withNames(scope, node.context, node.index);
				visit(node.key, inside, where);
				visitFragment(node.body, inside);
				visitFragment(node.fallback, scope);
				return;
			}
			case "AwaitBlock":
				visit(node.expression, scope, where);
				visitFragment(node.pending, scope);
				visitFragment(node.then, withNames(scope, node.value));
				visitFragment(node.catch, withNames(scope, node.error));
				return;
			case "SnippetBlock": {
				const inside = withNames(scope, ...node.parameters);
				for (const parameter of node.parameters) visit(parameter, inside, where);
				visitFragment(node.body, inside);
				return;
			}
		}
		if (FUNCTIONS.has(node.type)) {
			if (!isMainThreadFunction(node)) {
				visitChildren(node, withNames(scope, ...localNames(node)), where);
				return;
			}
			const blockNames = freeNames(node).filter((name) => scope.has(name));
			found.push({ where, expression: node, blockNames });
			return;
		}
		visitChildren(node, scope, attributeLabel(node) ?? where);
	};
	visitFragment(ast.fragment, new Set());
	return found;
}
