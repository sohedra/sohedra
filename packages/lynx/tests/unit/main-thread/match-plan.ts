// Hydration's match as a value: a first frame's markup and the page the background rendered in,
// the plan out as lines of text, or the mismatch that refused it. The drawn ids are the parser's,
// from 2 in the markup's order; the cells Lynx holds are parsed after the page, in the order given.
// The lines go kind by kind, and are sorted within each kind: the order the match found its pairs
// in means nothing.

import { isBlock, parseCell, parsePage } from "../../../src/main-thread/frame/html.ts";
import type { DrawnCell, DrawnChild } from "../../../src/main-thread/frame/html.ts";
import { matchFrame } from "../../../src/main-thread/hydrate/match.ts";
import type { Plan } from "../../../src/main-thread/hydrate/match.ts";
import { readRendered } from "../../../src/main-thread/hydrate/rendered.ts";
import type { Rendered } from "../../../src/main-thread/hydrate/rendered.ts";
import { encodeCell, listUpdateInfo, OpCode, ROOT_ID } from "../../../src/wire/index.ts";
import type { AttrValue, HydrationMismatch, Op, PatchItem } from "../../../src/wire/index.ts";

/**
 * A node the background rendered: a text, an element with its attributes and children, or a block
 * with the branch it took, as Svelte numbers an `{#if}`'s or as a `BranchKey`. A list of the page
 * has `rows` instead of children: its items, each a `<list-item>` sent as a cell item.
 */
export type Built = string | BuiltElement | BuiltBlock;

/** A block the background rendered: its content goes among its parent's children, and a mark says which. */
export interface BuiltBlock {
	branch: number;
	children: Built[];
	/** `true`: its mark cannot be read, as one the background writes for a block it lost track of. */
	unreadable?: true;
}

export interface BuiltElement {
	id: number;
	tag: string;
	attrs?: Record<string, AttrValue>;
	children?: Built[];
	rows?: BuiltRow[];
}

/** A row of a list of the page: its item key, and its `<list-item>`'s id and children. */
export interface BuiltRow {
	id: number;
	key: string;
	attrs?: Record<string, AttrValue>;
	children?: Built[];
	/** `false`: the background sent no cell item for the row. */
	sent?: false;
}

/** The first frame's state that is not in its markup. */
export interface Held {
	/** The cells Lynx holds, by item key, with their elements. */
	cells?: string[];
	/** The cells Lynx holds, by item key, that it handed back: their elements are let go of. */
	handedBack?: string[];
}

/** Text ids, counted apart from the elements' own, from 1000 for each page. */
let nextText = 1000;

/** How many children each parent has had put in, which a block's mark counts from. */
const inserted = new Map<number, number>();

function insert(out: Op[], parent: number, id: number): void {
	out.push([OpCode.Insert, parent, id, 0]);
	inserted.set(parent, (inserted.get(parent) ?? 0) + 1);
}

/** The ops that make `built` under `parent`, each child appended; a list's rows go in `cells`. */
function opsOf(options: { parent: number; built: Built; out: Op[]; cells: PatchItem[] }): void {
	const { parent, built, out, cells } = options;
	if (typeof built === "string") {
		const id = nextText++;
		out.push([OpCode.CreateText, id, built]);
		insert(out, parent, id);
		return;
	}
	// A block's content is its parent's, and its mark follows it: an inner block is one entry.
	if ("branch" in built) {
		for (const child of built.children) opsOf({ parent, built: child, out, cells });
		const at = inserted.get(parent) ?? 0;
		out.push([
			OpCode.Branch,
			parent,
			built.branch,
			built.children.length,
			built.unreadable ? -1 : at,
		]);
		return;
	}
	out.push([OpCode.Create, built.id, built.tag]);
	for (const [name, value] of Object.entries(built.attrs ?? {}))
		out.push([OpCode.SetAttr, built.id, name, value]);
	for (const child of built.children ?? []) opsOf({ parent: built.id, built: child, out, cells });
	insert(out, parent, built.id);
	if (!built.rows) return;
	const items = built.rows.map((row) => row.id);
	for (const row of built.rows) {
		const ops: Op[] = [];
		const element: BuiltElement = {
			id: row.id,
			tag: "list-item",
			attrs: { "item-key": row.key, ...row.attrs },
			children: row.children ?? [],
		};
		opsOf({ parent: built.id, built: element, out: ops, cells });
		// A cell's text makes its row; the list hears of it in its update, not by an insert.
		ops.pop();
		if (row.sent !== false) cells.push(["cell", row.id, encodeCell(ops)]);
	}
	const infos = new Map(built.rows.map((row) => [row.id, { "item-key": row.key }]));
	out.push([
		OpCode.ListUpdate,
		built.id,
		listUpdateInfo({ committed: [], items, infos, changed: new Set() }),
		items,
		items,
		[],
	]);
}

/** Matches the first frame drawn from `markup` against the page whose root's children are `built`. */
function match(
	markup: string,
	built: Built[],
	held: Held,
): { result: Plan | { mismatch: HydrationMismatch }; rendered: Rendered } {
	let next = ROOT_ID;
	const nextId = (): number => ++next;
	nextText = 1000;
	inserted.clear();
	const root = parsePage(markup, ROOT_ID, nextId);
	const ops: Op[] = [];
	const cells: PatchItem[] = [];
	for (const child of built) opsOf({ parent: ROOT_ID, built: child, out: ops, cells });
	const items: PatchItem[] = [["ops", ops], ...cells];
	const rendered = readRendered(items, items.length);
	/** The cells of the page's lists, as drawn. */
	const drawnLists: { list: number; cells: DrawnCell[] }[] = [];
	const visit = (child: DrawnChild): void => {
		if (!isBlock(child) && child.cells) drawnLists.push({ list: child.id, cells: child.cells });
		child.children.forEach(visit);
	};
	visit(root);
	/** Each list's held cells, by the cell's id. */
	const lists = new Map<number, Map<number, { bound: boolean }>>();
	// Lynx asks for cells after the page is drawn, in the order the test names them.
	const asked = [...(held.cells ?? []), ...(held.handedBack ?? [])];
	for (const key of asked)
		for (const { list, cells } of drawnLists)
			for (const cell of cells) {
				if (cell.attrs.get("item-key") !== key) continue;
				let state = lists.get(list);
				if (!state) lists.set(list, (state = new Map()));
				state.set(cell.id, { bound: held.cells?.includes(key) ?? false });
				parseCell(cell, nextId);
			}
	const result = matchFrame({
		root,
		rendered,
		lists: { held: (list) => lists.get(list) ?? new Map() },
	});
	return { result, rendered };
}

/** The plan as lines: what is adopted, written, made again, and what hydration is not sure of. */
function lines(plan: Plan, rendered: Rendered): string[] {
	const out: string[] = [];
	const ids = (list: number[]): string => list.join(" ") || "none";
	const numeric = (a: number, b: number): number => a - b;
	const what = (id: number): string => {
		const node = rendered.nodes.get(id);
		if (!node) return "?";
		return node.tag === "#text" ? JSON.stringify(node.text) : `<${node.tag}>`;
	};
	for (const [id, drawn] of [...plan.adopt].sort((a, b) => a[1] - b[1]))
		out.push(`adopt ${id} ${what(id)} = ${drawn}`);
	const writes = [...plan.writes].sort(
		(a, b) => a.id - b.id || (a.name ?? "").localeCompare(b.name ?? ""),
	);
	for (const { id, name, value } of writes)
		out.push(`write ${id} ${name ?? "text"} ${JSON.stringify(value)}`);
	for (const { parent, drawnParent, make, drop } of [...plan.repairs].sort(
		(a, b) => a.drawnParent - b.drawnParent,
	))
		out.push(`make again in ${parent} = ${drawnParent}: make ${ids(make)}, drop ${ids(drop)}`);
	// A parent's texts made again with none to make or drop change nothing: left out.
	for (const { parent, drawnParent, make, drop } of [...plan.textRepairs].sort(
		(a, b) => a.drawnParent - b.drawnParent,
	))
		if (make.length > 0 || drop.length > 0)
			out.push(`texts again in ${parent} = ${drawnParent}: make ${ids(make)}, drop ${ids(drop)}`);
	for (const { id, drawn, items, cells } of [...plan.lists].sort((a, b) => a.drawn - b.drawn)) {
		const kept = cells.map((cell) => cell ?? "-").join(" ");
		out.push(`list ${id} = ${drawn}: items ${ids(items)}, cells ${kept || "none"}`);
	}
	if (plan.adoptedCells.size > 0)
		out.push(`adopted cells ${ids([...plan.adoptedCells].sort(numeric))}`);
	for (const { id, drawn } of [...plan.nestedLists].sort((a, b) => a.drawn - b.drawn))
		out.push(`list in a cell ${id} = ${drawn}`);
	const propsIds = [...plan.propsIds].sort(
		(a, b) => a.element - b.element || a.name.localeCompare(b.name),
	);
	for (const { element, name, expected, got } of propsIds)
		out.push(`props id ${element} ${name} ${JSON.stringify(expected)} over ${JSON.stringify(got)}`);
	if (plan.unsure.size > 0) out.push(`unsure ${ids([...plan.unsure].sort(numeric))}`);
	return out;
}

/** The plan of a hydration the match accepts. Throws when it refuses. */
export function matchPlan(markup: string, built: Built[], held: Held = {}): Plan {
	const { result } = match(markup, built, held);
	if ("mismatch" in result) throw new Error(`refused: ${JSON.stringify(result.mismatch)}`);
	return result;
}

/** The plan of a hydration the match accepts, as lines. Throws when it refuses. */
export function planOf(markup: string, built: Built[], held: Held = {}): string[] {
	const { result, rendered } = match(markup, built, held);
	if ("mismatch" in result) throw new Error(`refused: ${JSON.stringify(result.mismatch)}`);
	return lines(result, rendered);
}

/** The mismatch that refuses a hydration. Throws when the match accepts it. */
export function refusalOf(markup: string, built: Built[], held: Held = {}): HydrationMismatch {
	const { result, rendered } = match(markup, built, held);
	if (!("mismatch" in result)) throw new Error(`adopted:\n${lines(result, rendered).join("\n")}`);
	return result.mismatch;
}
