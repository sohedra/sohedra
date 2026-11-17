// A main-thread function written in the markup, in an attribute that runs on the main thread:
//
//   <view main-thread:ontap={(event) => { 'main thread'; ... }}>
//
// is declared in the instance script as `const __mainThread0 = ...` instead, and the markup keeps
// the name, so it is compiled like any other. The same text gives the same names on both threads,
// so the ids still agree.

import type { ComponentAst } from "../../svelte/build/index.ts";
import { MAIN_THREAD_PREFIX } from "../../wire/index.ts";
import { isMainThreadFunction, patternNames } from "./directive.ts";
import type { Node } from "./node.ts";

const TYPE_KEYS = new Set(["typeAnnotation", "returnType", "typeParameters", "typeArguments"]);

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

/** A main-thread function written in an attribute of the markup. */
export interface InlineFunction {
	/** The attribute it is the value of. */
	attribute: Node;
	/** The function. */
	expression: Node;
	/** The names that exist only where it is written: `{#each}` items, snippet parameters, `{@const}`. */
	blockNames: string[];
}

/** The inline main-thread functions of the markup, in source order. */
export function inlineFunctions(ast: ComponentAst): InlineFunction[] {
	const found: InlineFunction[] = [];
	const visitFragment = (fragment: Node, scope: Set<string>): void => {
		if (!fragment?.nodes) return;
		const local = new Set(scope);
		for (const node of fragment.nodes) {
			if (node.type === "ConstTag")
				for (const declarator of node.declaration.declarations)
					patternNames(declarator.id).forEach((name) => local.add(name));
		}
		for (const node of fragment.nodes) visitNode(node, local);
	};
	const withNames = (scope: Set<string>, ...patterns: Node[]): Set<string> => {
		const next = new Set(scope);
		for (const pattern of patterns) {
			if (typeof pattern === "string") next.add(pattern);
			else patternNames(pattern).forEach((name) => next.add(name));
		}
		return next;
	};
	const visitNode = (node: Node, scope: Set<string>): void => {
		switch (node.type) {
			case "IfBlock":
				visitFragment(node.consequent, scope);
				visitFragment(node.alternate, scope);
				return;
			case "EachBlock":
				visitFragment(node.body, withNames(scope, node.context, node.index));
				visitFragment(node.fallback, scope);
				return;
			case "AwaitBlock":
				visitFragment(node.pending, scope);
				visitFragment(node.then, withNames(scope, node.value));
				visitFragment(node.catch, withNames(scope, node.error));
				return;
			case "KeyBlock":
				visitFragment(node.fragment, scope);
				return;
			case "SnippetBlock":
				visitFragment(node.body, withNames(scope, ...node.parameters));
				return;
		}
		for (const attribute of node.attributes ?? []) {
			if (attribute.type !== "Attribute" || !attribute.name.startsWith(MAIN_THREAD_PREFIX))
				continue;
			const value = Array.isArray(attribute.value) ? undefined : attribute.value;
			if (value?.type === "ExpressionTag" && isMainThreadFunction(value.expression)) {
				const blockNames = freeNames(value.expression).filter((name) => scope.has(name));
				found.push({ attribute, expression: value.expression, blockNames });
			}
		}
		visitFragment(node.fragment, scope);
	};
	visitFragment(ast.fragment, new Set());
	return found;
}
