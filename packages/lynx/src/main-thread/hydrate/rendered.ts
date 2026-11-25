// The page as the background rendered it: the tree that the first patch's rendered items describe
// (`Patch.rendered`), before any effect ran. Hydration matches the first frame against it.

import { decodeCell, OpCode, ROOT_ID, unknownKind, unknownKindError } from "../../wire/index.ts";
import type { AttrValue, CallItem, Op, PatchItem } from "../../wire/index.ts";
import { DEV } from "../globals.ts";

/** An element or a text the background rendered, by its id. */
export interface RenderedNode {
	id: number;
	/** The op that makes it. */
	create: Op;
	/** The element's tag; `#text` for a text. */
	tag: string;
	/** The text of a text. */
	text: string;
	/** Its attributes as rendered. */
	attrs: Map<string, AttrValue>;
	/** Its other ops, in order: events, styles from code, attributes set again. */
	ops: Op[];
	children: number[];
	parent: number;
	/** A list on the page: its items and its update. */
	list: { items: number[]; keys: unknown[]; update: Op } | null;
}

/** What the rendered items hold. */
export interface Rendered {
	nodes: Map<number, RenderedNode>;
	/** The text of each list cell, by the cell's id, as the items carry it. */
	cells: Map<number, string[]>;
	/** The function contexts each cell's texts hold, when any do. */
	cellContexts: Map<number, number[]>;
	/** Calls among the rendered items, which run after the page is hydrated. */
	calls: CallItem[];
}

/** The rendered items describe no tree: an op names an element they never made. */
export class NotATree extends Error {}

function made(nodes: Map<number, RenderedNode>, id: number, op: Op): RenderedNode {
	const node = nodes.get(id);
	if (!node) throw new NotATree(`An op of code ${op[0]} names the element ${id}, never made.`);
	return node;
}

function readOps(nodes: Map<number, RenderedNode>, ops: Op[]): void {
	for (const op of ops) {
		switch (op[0]) {
			case OpCode.Create:
			case OpCode.CreateText:
				nodes.set(op[1], {
					id: op[1],
					create: op,
					tag: op[0] === OpCode.Create ? op[2] : "#text",
					text: op[0] === OpCode.CreateText ? op[2] : "",
					attrs: new Map(),
					ops: [],
					children: [],
					parent: 0,
					list: null,
				});
				break;
			case OpCode.SetAttr: {
				const node = made(nodes, op[1], op);
				if (op[3] === null) node.attrs.delete(op[2]);
				else node.attrs.set(op[2], op[3]);
				break;
			}
			case OpCode.SetText:
				made(nodes, op[1], op).text = op[2];
				break;
			case OpCode.SetEvent:
			case OpCode.SetStyles:
			case OpCode.Animate:
				made(nodes, op[1], op).ops.push(op);
				break;
			case OpCode.Insert: {
				const parent = made(nodes, op[1], op);
				const child = made(nodes, op[2], op);
				const at = op[3] === 0 ? -1 : parent.children.indexOf(op[3]);
				if (at === -1) parent.children.push(op[2]);
				else parent.children.splice(at, 0, op[2]);
				child.parent = op[1];
				break;
			}
			case OpCode.Remove: {
				const children = made(nodes, op[1], op).children;
				const at = children.indexOf(op[2]);
				if (at !== -1) children.splice(at, 1);
				break;
			}
			case OpCode.Release:
				if (op[1] !== ROOT_ID) nodes.delete(op[1]);
				break;
			case OpCode.ListUpdate: {
				const insertions = op[2].insertAction;
				made(nodes, op[1], op).list = {
					items: op[3],
					keys: insertions.map((insertion) => insertion["item-key"]),
					update: op,
				};
				break;
			}
			default:
				if (DEV) throw unknownKindError(op, "main-thread");
		}
	}
}

/** The tree the first `count` items of a patch describe. Throws `NotATree` when they describe none. */
export function readRendered(items: PatchItem[], count: number): Rendered {
	const nodes = new Map<number, RenderedNode>();
	nodes.set(ROOT_ID, {
		id: ROOT_ID,
		create: [OpCode.Create, ROOT_ID, "page"],
		tag: "page",
		text: "",
		attrs: new Map(),
		ops: [],
		children: [],
		parent: 0,
		list: null,
	});
	const cells = new Map<number, string[]>();
	const cellContexts = new Map<number, number[]>();
	const calls: CallItem[] = [];
	for (const item of items.slice(0, count)) {
		switch (item[0]) {
			case "ops":
				readOps(nodes, item[1]);
				break;
			case "cell": {
				let parts = cells.get(item[1]);
				if (!parts) cells.set(item[1], (parts = []));
				parts.push(item[2]);
				const contexts = item[4];
				if (contexts)
					cellContexts.set(item[1], [...(cellContexts.get(item[1]) ?? []), ...contexts]);
				break;
			}
			case "call":
				calls.push(item);
				break;
			case "reply":
			case "rewrite":
				throw new NotATree(`A patch's rendered part holds an item of kind ${item[0]}.`);
			default:
				// A development build reports the kind as the page waits to be written again.
				throw new NotATree(`A patch's rendered part holds an item of kind ${unknownKind(item)}.`);
		}
	}
	return { nodes, cells, cellContexts, calls };
}

/** Adds a cell's own nodes, from its text, to the tree. */
export function readCell(rendered: Rendered, id: number): RenderedNode | undefined {
	for (const part of rendered.cells.get(id) ?? []) readOps(rendered.nodes, decodeCell(part));
	return rendered.nodes.get(id);
}

/** The ops that make a rendered node and what is under it, as the background sent them. */
export function opsOf(rendered: Rendered, id: number, out: Op[] = []): Op[] {
	const node = rendered.nodes.get(id)!;
	out.push(node.create);
	for (const [name, value] of node.attrs) out.push([OpCode.SetAttr, id, name, value]);
	for (const op of node.ops) out.push(op);
	for (const child of node.children) {
		opsOf(rendered, child, out);
		out.push([OpCode.Insert, id, child, 0]);
	}
	if (node.list) out.push(node.list.update);
	return out;
}
