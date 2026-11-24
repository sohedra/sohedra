// A component's code, as the script checks read it: its two scripts, and its markup's expressions
// with the names its blocks declare.

import { scriptProgram } from "../../svelte/build/index.ts";
import type { AnyNode, ComponentAst } from "../../svelte/build/index.ts";
import type { Thread } from "../../wire/index.ts";
import { oneThreadFragments } from "../compile/thread-branches.ts";
import type { OneThreadBranch } from "../compile/thread-branches.ts";
import { patternNames } from "../main-thread-functions/directive.ts";
import type { MarkupExpression, ScriptRoots } from "./script-uses.ts";

/** The types of Svelte's markup nodes; any other node with a type is JavaScript. */
const MARKUP = new Set([
	"Fragment",
	"Text",
	"Comment",
	"ExpressionTag",
	"HtmlTag",
	"ConstTag",
	"DebugTag",
	"RenderTag",
	"AttachTag",
	"IfBlock",
	"EachBlock",
	"AwaitBlock",
	"KeyBlock",
	"SnippetBlock",
	"RegularElement",
	"Component",
	"SvelteBody",
	"SvelteComponent",
	"SvelteDocument",
	"SvelteElement",
	"SvelteFragment",
	"SvelteBoundary",
	"SvelteHead",
	"SvelteOptionsRaw",
	"SvelteSelf",
	"SvelteWindow",
	"SlotElement",
	"TitleElement",
	"Attribute",
	"SpreadAttribute",
	"AnimateDirective",
	"BindDirective",
	"ClassDirective",
	"LetDirective",
	"OnDirective",
	"StyleDirective",
	"TransitionDirective",
	"UseDirective",
]);

/** Keys of markup nodes that declare names rather than read them. */
const DECLARING = new Set(["context", "parameters", "value", "error"]);

/** What a component's markup declares and reads. */
interface Markup {
	declared: Set<string>;
	expressions: MarkupExpression[];
	/** The branches only one thread renders, by their fragment. */
	branches: ReadonlyMap<AnyNode, OneThreadBranch>;
}

/** Where in the markup a node is: the thread of its branch, and the element whose attribute holds it. */
interface Context {
	thread: Thread | undefined;
	anchor: number | undefined;
}

function walkMarkup(node: unknown, markup: Markup, context: Context): void {
	if (!node || typeof node !== "object") return;
	if (Array.isArray(node)) {
		for (const item of node) walkMarkup(item, markup, context);
		return;
	}
	// Boundary: the markup's nodes are read by shape.
	const record = node as AnyNode;
	if (typeof record.type === "string" && !MARKUP.has(record.type)) {
		markup.expressions.push({ node: record, ...context });
		return;
	}
	const branch = markup.branches.get(record);
	const here: Context = branch ? { thread: branch.thread, anchor: undefined } : context;
	for (const [key, value] of Object.entries(record)) {
		if (DECLARING.has(key) && record.type !== "Attribute" && record.type !== "StyleDirective") {
			for (const pattern of Array.isArray(value) ? value : [value])
				for (const name of patternNames(pattern)) markup.declared.add(name);
			continue;
		}
		if (record.type === "EachBlock" && key === "index" && typeof value === "string") {
			markup.declared.add(value);
			continue;
		}
		if (record.type === "SnippetBlock" && key === "expression") {
			for (const name of patternNames(value)) markup.declared.add(name);
			continue;
		}
		if (record.type === "ConstTag" && key === "declaration") {
			// Boundary: a `{@const}` holds one variable declaration, read by shape.
			for (const declarator of (value as AnyNode).declarations as AnyNode[]) {
				for (const name of patternNames(declarator.id)) markup.declared.add(name);
				markup.expressions.push({ node: declarator.init as AnyNode, ...here });
			}
			continue;
		}
		// An element's attributes: a silencing comment above the element applies to them.
		const anchor =
			key === "attributes" ? record.start : key === "fragment" ? undefined : here.anchor;
		walkMarkup(value, markup, { thread: here.thread, anchor });
	}
}

/** A component's code for the script checks. Positions are the component's. */
export function componentRoots(ast: ComponentAst): ScriptRoots {
	const markup: Markup = {
		declared: new Set(),
		expressions: [],
		branches: oneThreadFragments(ast),
	};
	walkMarkup(ast.fragment, markup, { thread: undefined, anchor: undefined });
	const programs = [scriptProgram(ast.module), scriptProgram(ast.instance)].filter(
		(program) => program !== undefined,
	);
	return { programs, declared: markup.declared, expressions: markup.expressions };
}
