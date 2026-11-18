// A drawn tree as text, one line per node with its id, for comparing what the first frame's parser
// reads: elements with their attributes and events, texts, blocks, and a list's cells with their
// markup, then what each cell's markup reads as, in order, as Lynx would ask for them.

import { isBlock, parseCell, parsePage } from "../../../src/main-thread/frame/html.ts";
import type { DrawnChild, NextId } from "../../../src/main-thread/frame/html.ts";
import { ROOT_ID } from "../../../src/wire/index.ts";

/** Adds the lines of `child` and what is under it to `out`, indented by `depth`. */
function write(child: DrawnChild, depth: number, out: string[], nextId: NextId): void {
	const pad = "  ".repeat(depth);
	if (isBlock(child)) {
		out.push(`${pad}[block]`);
		for (const inner of child.children) write(inner, depth + 1, out, nextId);
		return;
	}
	if (child.tag === "#text") {
		out.push(`${pad}${child.id} ${JSON.stringify(child.text)}`);
		return;
	}
	const attrs = child.attrs.size > 0 ? ` ${JSON.stringify(Object.fromEntries(child.attrs))}` : "";
	const events = child.events.map(({ type, name }) => ` ${type}:${name}`).join("");
	out.push(`${pad}${child.id} <${child.tag}>${attrs}${events}`);
	for (const inner of child.children) write(inner, depth + 1, out, nextId);
	for (const cell of child.cells ?? []) {
		const cellAttrs = JSON.stringify(Object.fromEntries(cell.attrs));
		const deferred = cell.deferred ? " deferred" : "";
		out.push(`${pad}  ${cell.id} cell ${cellAttrs}${deferred} ${JSON.stringify(cell.html)}`);
		for (const inner of parseCell(cell, nextId).children) write(inner, depth + 2, out, nextId);
	}
}

/** The tree the parser reads from a page's markup, as text. */
export function drawnTree(markup: string): string {
	let next = ROOT_ID;
	const nextId = (): number => ++next;
	const page = parsePage(markup, ROOT_ID, nextId);
	const out: string[] = [];
	for (const child of page.children) write(child, 0, out, nextId);
	return out.join("\n");
}
