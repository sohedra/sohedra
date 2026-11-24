// `<list-item defer>`: the row's contents render only once Lynx first asks for the row, unless the
// row is among its list's initial rows, which render whole as the page starts.
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
// is wrapped in `{#if true}`. The first frame draws a deferred row empty, and writes its `defer`,
// which the main thread reads there; a row among the initial rows it draws whole, with no `defer`.
//
// The initial rows (`src/svelte/runtime/initial-rows.ts`): each `<list>` that may hold a deferred row
// (one written among its rows, or a component, a snippet or a slot there that may render one) opens
// its count before its rows and closes it after them, and each row that waits asks for its place
// where both threads reach it in the same order: the background in the `{#if}` on its state, which
// reads `ready` first; the first frame in its `defer`, whose value the row's `{#if}` then reads
// back. Any other list is left as it is written. A row with
// no `defer` in a list written here with a deferred row counts too, in a block before it on the
// background and an attribute the first frame never writes, so a header or a footer takes its place.
// A row in a branch only one thread renders (`{#if background}`) counts on neither.

import path from "node:path";

import {
	attributesOf,
	attributeValue,
	field,
	nodes,
	scriptProgram,
} from "../../svelte/build/index.ts";
import type { AnyNode } from "../../svelte/build/index.ts";
import { DEFER, DEFERRED_ROW, RENDERER_ENTRY } from "../../wire/index.ts";
import { buildWarning, placeAt } from "../diagnostics/messages.ts";
import type { Edit } from "../source-map/edits.ts";
import { position } from "../source-map/maps.ts";
import { stringLiteral } from "../string-literal.ts";
import type { Pass, PassContext } from "./pass.ts";
import { oneThreadFragments } from "./thread-branches.ts";

const LIST = "list";
const TAG = "list-item";
const ROW = "__sohedraLynxRow";
const FACTORY = "__sohedraLynxDeferredRow";
const FULL_SPAN = "full-span";

/** The initial rows' helpers, from the thread's runtime, by the names the markup calls them. */
const SCREEN = {
	list: ["initialRowsList", "__sohedraLynxList"],
	end: ["initialRowsEnd", "__sohedraLynxListEnd"],
	count: ["initialRow", "__sohedraLynxCount"],
	defer: ["initialRowDefer", "__sohedraLynxDefer"],
	waits: ["initialRowWaits", "__sohedraLynxWaits"],
} as const;

/** The attributes the first frame never writes: their values are always `undefined`. */
const LIST_HOOK = "sohedra-lynx-list";
const COUNT_HOOK = "sohedra-lynx-count";

/** The attributes of a `<list>` the count of its initial rows reads. */
const SCREEN_ATTRIBUTES = new Set([
	"span-count",
	"column-count",
	"preload-buffer-count",
	"initial-item-count",
	"initial-scroll-index",
]);

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

const isElement = (node: AnyNode, tag: string): boolean =>
	node.type === "RegularElement" && node.name === tag;

/** Where a node is: the `<list>` nearest around it, and whether only one thread renders it. */
interface Placed {
	node: AnyNode;
	list: AnyNode | undefined;
	/** Inside a `<list-item>` of that list, not among its rows. */
	inRow: boolean;
	oneThread: boolean;
}

/** What may render rows from elsewhere where a list's rows are. */
const ROW_SOURCES = new Set([
	"Component",
	"SvelteComponent",
	"SvelteSelf",
	"RenderTag",
	"SlotElement",
]);

/** Every node of `node`'s tree, where it is: the walk of `nodes`. */
function* placedNodes(
	node: unknown,
	around: Omit<Placed, "node">,
	oneThreadFragments: ReadonlyMap<AnyNode, unknown>,
): Generator<Placed> {
	if (!node || typeof node !== "object") return;
	if (Array.isArray(node)) {
		for (const child of node) yield* placedNodes(child, around, oneThreadFragments);
		return;
	}
	// Boundary: the AST's nodes are read by shape, as `nodes` reads them.
	const record = node as AnyNode;
	yield { node: record, ...around };
	const list = isElement(record, LIST);
	const inner = {
		list: list ? record : around.list,
		inRow: !list && (around.inRow || isElement(record, TAG)),
		oneThread: around.oneThread || oneThreadFragments.has(record),
	};
	for (const key of Object.keys(record)) {
		if (key === "parent" || key === "metadata") continue;
		yield* placedNodes(record[key], inner, oneThreadFragments);
	}
}

/** An element's child nodes. */
const childrenOf = (element: AnyNode): AnyNode[] =>
	// Boundary: the node is read by shape; an element's children are its fragment's nodes.
	(field(element, "fragment")?.nodes ?? []) as AnyNode[];

/** The attribute written as `name` on `element`, not in a spread. */
const attributeNamed = (element: AnyNode, name: string): AnyNode | undefined =>
	attributesOf(element).find(
		(attribute) => attribute.type === "Attribute" && attribute.name === name,
	);

/**
 * An attribute's value as an expression: `true` for a bare one, the expression of `{x}`, and a
 * quoted value as the text it is.
 */
function valueText(source: string, attribute: AnyNode): string {
	const value = attributeValue(attribute);
	if (value === true) return "true";
	const parts = value.map((part) => {
		if (part.type === "Text") return stringLiteral(String(part["data"]));
		const expression = field(part, "expression")!;
		return `(${source.slice(expression.start, expression.end)})`;
	});
	return parts.length === 1 ? parts[0]! : `"" + ${parts.join(" + ")}`;
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

/** A row's `full-span`, as an expression, or `undefined` when it has none written. */
function fullSpanText(source: string, element: AnyNode): string | undefined {
	const attribute = attributeNamed(element, FULL_SPAN);
	return attribute && valueText(source, attribute);
}

/** What the count of a list's initial rows reads of its attributes, spreads included, in the order written. */
function listAttributesText(source: string, list: AnyNode): string | undefined {
	const parts: string[] = [];
	for (const attribute of attributesOf(list)) {
		if (attribute.type === "SpreadAttribute") {
			const expression = field(attribute, "expression")!;
			parts.push(`...(${source.slice(expression.start, expression.end)})`);
		} else if (attribute.type === "Attribute" && SCREEN_ATTRIBUTES.has(String(attribute.name)))
			parts.push(`${stringLiteral(String(attribute.name))}: ${valueText(source, attribute)}`);
	}
	return parts.length === 0 ? undefined : `() => ({ ${parts.join(", ")} })`;
}

/**
 * The imports the markup's edits call, in a script of the component or a new module script, on one
 * line: the lines below keep their numbers, which Svelte's development build gives each element.
 */
function importEdit(ast: PassContext["ast"], lines: string[]): Edit {
	const text = lines.join(" ");
	const program = scriptProgram(ast.module) ?? scriptProgram(ast.instance);
	if (program) {
		const at = program.start;
		return { start: at, end: at, text: ` ${text} ` };
	}
	return { start: 0, end: 0, text: `<script module>${text}</script>` };
}

/** Whether a spread is an object written out with a `defer` in it. */
function spreadsDefer(attribute: AnyNode): boolean {
	const expression = field(attribute, "expression");
	if (expression?.type !== "ObjectExpression") return false;
	// Boundary: the node is read by shape; an object expression has its properties.
	return (expression["properties"] as AnyNode[]).some((property) => {
		const key = field(property, "key");
		return (
			property.type === "Property" &&
			((key?.type === "Identifier" && key["name"] === DEFER) ||
				(key?.type === "Literal" && key["value"] === DEFER))
		);
	});
}

/**
 * Where `defer` is written that the pass cannot see to: in a spread written out on a `<list-item>`,
 * or on a `<svelte:element>`. A spread held in a variable cannot be read here.
 */
function ignoredDefer(element: AnyNode): string | undefined {
	const attributes = attributesOf(element);
	if (element.type === "SvelteElement")
		return attributes.some(
			(attribute) => attribute.type === "Attribute" && attribute.name === DEFER,
		)
			? "on <svelte:element>"
			: undefined;
	if (element.type !== "RegularElement" || element.name !== TAG) return undefined;
	return attributes.some(
		(attribute) => attribute.type === "SpreadAttribute" && spreadsDefer(attribute),
	)
		? "in a spread"
		: undefined;
}

/** The edits that defer the contents of each `<list-item defer>`, and count each list's initial rows. */
export const deferredRows: Pass = (context) => {
	const { source, filename, ast, thread, development, internals, warnings } = context;
	const background = thread === "background";
	const places = background ? constPlaces(ast.fragment) : new Set<AnyNode>();
	// The initial rows' helpers come from the thread's runtime: a build that gives none counts none.
	const countsRows = internals !== undefined;
	const placed = [
		...placedNodes(
			ast.fragment,
			{ list: undefined, inRow: false, oneThread: false },
			oneThreadFragments(ast),
		),
	];
	// The lists with a deferred row written among their rows, whose other rows count too; and those
	// whose rows may be deferred rows written elsewhere. The others are left as they are written.
	const withDeferred = new Set<AnyNode>();
	const counting = new Set<AnyNode>();
	for (const { node, list, inRow } of placed) {
		if (!list) continue;
		if (isElement(node, TAG) && attributeNamed(node, DEFER)) withDeferred.add(list);
		else if (!inRow && ROW_SOURCES.has(String(node.type))) counting.add(list);
	}
	for (const list of withDeferred) counting.add(list);

	// A list opens first and closes last where another edit is at the same place.
	const opening: Edit[] = [];
	const edits: Edit[] = [];
	const closing: Edit[] = [];
	const used = new Set<keyof typeof SCREEN>();
	const call = (helper: keyof typeof SCREEN, args: string): string => {
		used.add(helper);
		return `${SCREEN[helper][1]}(${args})`;
	};
	let count = 0;

	function openList(list: AnyNode): void {
		const children = childrenOf(list);
		if (!countsRows || children.length === 0 || !counting.has(list)) return;
		const read = listAttributesText(source, list) ?? "";
		// Counted from 0, as the places of Svelte's development build are.
		const [line, column] = position(source, list.start!);
		// With `/` on every system, as Svelte names a component's file.
		const file = path
			.relative(context.root ?? "", filename)
			.split(path.sep)
			.join("/");
		const where =
			background && development ? stringLiteral(`${file}:${line + 1}:${column}`) : undefined;
		const args = where === undefined ? read : `${read || "undefined"}, ${where}`;
		if (background)
			opening.push({
				start: children[0]!.start!,
				end: children[0]!.start!,
				text: `{#if ${call("list", args)}}{/if}`,
			});
		else {
			const name = list.start! + 1 + LIST.length;
			opening.push({ start: name, end: name, text: ` ${LIST_HOOK}={${call("list", args)}}` });
		}
		const end = children[children.length - 1]!.end!;
		closing.push({ start: end, end, text: `{#if ${call("end", "")}}{/if}` });
	}

	/** A row that counts with no state of its own: one with no `defer`, or with nothing in it. */
	function countRow(element: AnyNode): void {
		const fullSpan = fullSpanText(source, element) ?? "";
		const at = element.start!;
		if (background)
			edits.push({ start: at, end: at, text: `{#if ${call("count", fullSpan)}}{/if}` });
		else {
			const name = at + 1 + TAG.length;
			edits.push({ start: name, end: name, text: ` ${COUNT_HOOK}={${call("count", fullSpan)}}` });
		}
	}

	for (const { node: element, list, oneThread } of placed) {
		const ignored = development && background ? ignoredDefer(element) : undefined;
		if (ignored)
			warnings.push(
				buildWarning({
					code: "list_item_defer_ignored",
					details: { written: ignored },
					place: placeAt({ file: filename, text: source }, element.start!),
				}),
			);
		if (isElement(element, LIST)) {
			openList(element);
			continue;
		}
		if (!isElement(element, TAG)) continue;
		const defer = attributeNamed(element, DEFER);
		const children = childrenOf(element);
		const first = children[0];
		const last = children[children.length - 1];
		// A row only one thread renders takes no place among the initial rows, on either thread.
		const counts = countsRows && !oneThread;
		if (counts && list !== undefined && withDeferred.has(list) && !(defer && first))
			countRow(element);
		if (!defer) continue;
		const option = optionText(source, defer);
		const fullSpan = fullSpanText(source, element);
		if (!background) {
			// The first frame writes `defer` as its value, which the main thread reads.
			let value = option;
			if (first && last && counts) {
				value = call("defer", fullSpan === undefined ? option : `${option}, ${fullSpan}`);
				edits.push({ start: first.start!, end: first.start!, text: `{#if !${call("waits", "")}}` });
				edits.push({ start: last.end!, end: last.end!, text: "{/if}" });
			} else if (first && last) {
				edits.push({ start: first.start!, end: first.start!, text: `{#if !(${option})}` });
				edits.push({ start: last.end!, end: last.end!, text: "{/if}" });
			}
			edits.push({ start: defer.start!, end: defer.end!, text: `${DEFER}={${value}}` });
			continue;
		}
		const row = `${ROW}${count++}`;
		const place = oneThread
			? ", { oneThread: true }"
			: fullSpan === undefined
				? ""
				: `, { fullSpan: () => (${fullSpan}) }`;
		const made = `{@const ${row} = ${FACTORY}(() => (${option})${place})}`;
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

	const imports: string[] = [];
	if (count > 0)
		imports.push(
			`import { deferredRow as ${FACTORY} } from ${stringLiteral(context.renderer ?? RENDERER_ENTRY)};`,
		);
	if (used.size > 0) {
		const names = [...used].map((helper) => `${SCREEN[helper][0]} as ${SCREEN[helper][1]}`);
		imports.push(`import { ${names.join(", ")} } from ${stringLiteral(internals!)};`);
	}
	const all = [...opening, ...edits, ...closing];
	// First: a new script at the very start goes before a block that wraps a row there.
	if (imports.length > 0) all.unshift(importEdit(ast, imports));
	return all;
};
