// `<list-item defer>`: the row's contents render only once Lynx first asks for the row.
//
// On the background, each such row gets its state (`deferredRow`, from the renderer's module),
// made once per row by a `{@const}`, linked to the element by an attribute the renderer takes, and
// its contents go in an `{#if}` on that state:
//
//   {@const __sohedraLynxRow0 = __sohedraLynxDeferredRow(() => (option))}
//   <list-item sohedra-lynx-row={__sohedraLynxRow0} defer={option}>
//     {#if __sohedraLynxRow0.ready}…{/if}
//   </list-item>
//
// A `{@const}` goes only in a block, a snippet or a component's children, so a row anywhere else
// is wrapped in `{#if true}`. The first frame draws a deferred row empty, `{#if !(option)}…{/if}`,
// and keeps `defer` in its markup: the main thread reads it there.

import {
	attributesOf,
	attributeValue,
	field,
	nodes,
	scriptProgram,
} from "../../svelte/build/index.ts";
import type { AnyNode } from "../../svelte/build/index.ts";
import { DEFER, DEFERRED_ROW, RENDERER_ENTRY } from "../../wire/index.ts";
import type { Edit } from "../source-map/edits.ts";
import { stringLiteral } from "../string-literal.ts";
import type { Pass } from "./pass.ts";

const TAG = "list-item";
const ROW = "__sohedraLynxRow";
const FACTORY = "__sohedraLynxDeferredRow";

/** The fields of the nodes whose fragments may hold a `{@const}`, by the node's type. */
const CONST_FRAGMENTS: Readonly<Record<string, readonly string[]>> = {
	EachBlock: ["body", "fallback"],
	IfBlock: ["consequent", "alternate"],
	KeyBlock: ["fragment"],
	AwaitBlock: ["pending", "then", "catch"],
	SnippetBlock: ["body"],
	Component: ["fragment"],
	SvelteBoundary: ["fragment"],
};

/** The nodes a `{@const}` may stand beside. */
function constPlaces(root: unknown): Set<AnyNode> {
	const places = new Set<AnyNode>();
	for (const node of nodes(root)) {
		for (const key of CONST_FRAGMENTS[String(node.type)] ?? []) {
			// Boundary: the node is read by shape; a fragment holds its nodes.
			for (const child of (field(node, key)?.nodes ?? []) as AnyNode[]) places.add(child);
		}
	}
	return places;
}

/** The source of the value `defer` is written with, as an expression. */
function optionText(source: string, attribute: AnyNode): string {
	const value = attributeValue(attribute);
	if (value === true) return "true";
	const [first] = value;
	if (value.length === 1 && first?.type === "ExpressionTag") {
		const expression = field(first, "expression")!;
		return source.slice(expression.start, expression.end);
	}
	if (value.length === 1 && first?.type === "Text") return stringLiteral(String(first["data"]));
	return "true";
}

/** The import of the rows' state, in a script of the component or a new module script. */
function importEdit(context: { ast: Parameters<Pass>[0]["ast"]; renderer: string }): Edit {
	const line = `import { deferredRow as ${FACTORY} } from ${stringLiteral(context.renderer)};`;
	const program = scriptProgram(context.ast.module) ?? scriptProgram(context.ast.instance);
	if (program) {
		const at = program.start;
		return { start: at, end: at, text: `\n${line}\n` };
	}
	return { start: 0, end: 0, text: `<script module>${line}</script>\n` };
}

/** The edits that defer the contents of each `<list-item defer>`. */
export const deferredRows: Pass = ({ source, ast, thread, renderer }) => {
	const edits: Edit[] = [];
	const places = thread === "background" ? constPlaces(ast.fragment) : new Set<AnyNode>();
	let count = 0;
	for (const element of nodes(ast.fragment)) {
		if (element.type !== "RegularElement" || element.name !== TAG) continue;
		const defer = attributesOf(element).find(
			(attribute) => attribute.type === "Attribute" && attribute.name === DEFER,
		);
		if (!defer) continue;
		const option = optionText(source, defer);
		// Boundary: the node is read by shape; an element's children are its fragment's nodes.
		const children = (field(element, "fragment")?.nodes ?? []) as AnyNode[];
		const first = children[0];
		const last = children[children.length - 1];
		if (thread === "main-thread") {
			if (first && last) {
				edits.push({ start: first.start!, end: first.start!, text: `{#if !(${option})}` });
				edits.push({ start: last.end!, end: last.end!, text: "{/if}" });
			}
			continue;
		}
		const row = `${ROW}${count++}`;
		const made = `{@const ${row} = ${FACTORY}(() => (${option}))}`;
		const wrapped = !places.has(element);
		const at = element.start!;
		edits.push({ start: at, end: at, text: wrapped ? `{#if true}${made}` : made });
		const name = at + 1 + TAG.length;
		edits.push({ start: name, end: name, text: ` ${DEFERRED_ROW}={${row}}` });
		if (first && last) {
			edits.push({ start: first.start!, end: first.start!, text: `{#if ${row}.ready}` });
			edits.push({ start: last.end!, end: last.end!, text: "{/if}" });
		}
		if (wrapped) edits.push({ start: element.end!, end: element.end!, text: "{/if}" });
	}
	if (count > 0) edits.push(importEdit({ ast, renderer: renderer ?? RENDERER_ENTRY }));
	return edits;
};
