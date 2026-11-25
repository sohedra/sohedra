// Both trees hydration matches, as entries: elements and Svelte's blocks, texts left out. The first
// frame's is read from its markup; the background's from the rendered items of its first patch, as
// the main thread receives them, branch marks and cells' texts included. Lined up with no shape
// check at all: element with element and block with block, a block's content only where both took
// the same branch. An independent account of what hydration may pair, which the match must stay
// within.

import { elementsOf, isBlock, parseCell } from "../../../src/main-thread/frame/html.ts";
import type { DrawnChild, DrawnNode } from "../../../src/main-thread/frame/html.ts";
import { matchFrame } from "../../../src/main-thread/hydrate/match.ts";
import type { Plan } from "../../../src/main-thread/hydrate/match.ts";
import { entriesOf, readCell, readRendered } from "../../../src/main-thread/hydrate/rendered.ts";
import type { Rendered, RenderedEntry } from "../../../src/main-thread/hydrate/rendered.ts";
import { BranchKey, ROOT_ID } from "../../../src/wire/index.ts";
import type { Patch } from "../../../src/wire/index.ts";

/** An element, by its id on its side, or a block with the branch it took. */
export type Entry =
	| { kind: "element"; id: number; tag: string; children: Entry[]; cells?: (Entry[] | "none")[] }
	| { kind: "block"; key: number; children: Entry[] };

/** The background's tree from a first patch; `unreadable` counts the parents whose marks are not. */
export function builtEntries(patch: Patch): {
	entries: Entry[];
	unreadable: number;
	rendered: Rendered;
} {
	const rendered = readRendered(patch.items, patch.rendered ?? 0);
	const counts = { unreadable: 0 };
	const under = (id: number): Entry[] => {
		const entries = entriesOf(rendered.nodes.get(id)!);
		if (entries === null) {
			counts.unreadable++;
			return [];
		}
		return convert(entries);
	};
	const convert = (entries: RenderedEntry[]): Entry[] => {
		const out: Entry[] = [];
		for (const entry of entries) {
			if (typeof entry !== "number") {
				const children = convert(entry.entries);
				if (entry.key === BranchKey.Second && children.length === 0) continue;
				out.push({ kind: "block", key: entry.key, children });
				continue;
			}
			const node = rendered.nodes.get(entry)!;
			if (node.tag === "#text") continue;
			const element: Entry = { kind: "element", id: entry, tag: node.tag, children: [] };
			if (node.list)
				element.cells = node.list.items.map((cell) => {
					if (!rendered.cells.has(cell)) return "none";
					readCell(rendered, cell);
					return under(cell);
				});
			else element.children = under(entry);
			out.push(element);
		}
		return out;
	};
	const entries = under(ROOT_ID);
	return { entries, unreadable: counts.unreadable, rendered };
}

/** The first frame's tree; a cell Lynx has not asked for is parsed with ids from `nextId`. */
export function drawnEntries(children: DrawnChild[], nextId: () => number): Entry[] {
	const out: Entry[] = [];
	for (const child of children) {
		if (isBlock(child)) {
			const inner = drawnEntries(child.children, nextId);
			if (child.key === BranchKey.Second && inner.length === 0) continue;
			out.push({ kind: "block", key: child.key, children: inner });
			continue;
		}
		if (child.tag === "#text") continue;
		const element: Entry = { kind: "element", id: child.id, tag: child.tag, children: [] };
		if (child.cells)
			element.cells = child.cells.map((cell) => {
				if (cell.deferred) return "none";
				return drawnEntries((cell.node ?? parseCell(cell, nextId)).children, nextId);
			});
		else element.children = drawnEntries(child.children, nextId);
		out.push(element);
	}
	return out;
}

/** How two trees line up. */
export interface Alignment {
	/** Each pair of elements in the same place, through blocks both took alike: built to drawn. */
	pairs: Map<number, number>;
	sameBlocks: number;
	otherBlocks: number;
	/** Where the trees stop lining up. */
	misaligned: string[];
}

const describe = (entry: Entry | undefined): string =>
	entry === undefined
		? "nothing"
		: entry.kind === "block"
			? `block ${entry.key}`
			: `<${entry.tag}>`;

/** Lines `built` up with `drawn`. */
export function align(
	built: Entry[],
	drawn: Entry[],
	result: Alignment = { pairs: new Map(), sameBlocks: 0, otherBlocks: 0, misaligned: [] },
	path = "page",
): Alignment {
	for (let index = 0; index < Math.max(built.length, drawn.length); index++) {
		const ours = built[index];
		const theirs = drawn[index];
		if (!ours || !theirs || ours.kind !== theirs.kind) {
			result.misaligned.push(
				`${path}[${index}]: built ${describe(ours)}, drawn ${describe(theirs)}`,
			);
			return result;
		}
		if (ours.kind === "block" && theirs.kind === "block") {
			// The place of an `{#await}` given a promise: the background draws its branch later.
			if (ours.key !== theirs.key || ours.key === BranchKey.Await) result.otherBlocks++;
			else {
				result.sameBlocks++;
				align(ours.children, theirs.children, result, `${path}{${ours.key}}`);
			}
			continue;
		}
		if (ours.kind !== "element" || theirs.kind !== "element" || ours.tag !== theirs.tag) {
			result.misaligned.push(
				`${path}[${index}]: built ${describe(ours)}, drawn ${describe(theirs)}`,
			);
			return result;
		}
		result.pairs.set(ours.id, theirs.id);
		const where = `${path}/${describe(ours)}`;
		if (ours.cells || theirs.cells) {
			const mine = ours.cells ?? [];
			const yours = theirs.cells ?? [];
			if (mine.length !== yours.length) {
				result.misaligned.push(`${where}: ${mine.length} built cells, ${yours.length} drawn`);
				return result;
			}
			mine.forEach((cell, at) => {
				const other = yours[at]!;
				if (cell !== "none" && other !== "none") align(cell, other, result, `${where}#${at}`);
			});
			continue;
		}
		align(ours.children, theirs.children, result, where);
	}
	return result;
}

/**
 * The pairs of the match's plan that hydration is sure of (an early event there is replayed) and
 * that the trees do not pair: an element whose events would run another element's handler.
 */
export function pairsAstray(matched: Matched, alignment: Alignment): string[] {
	const { plan, rendered } = matched;
	const astray: string[] = [];
	for (const [built, drawn] of plan.adopt) {
		if (rendered.nodes.get(built)?.tag === "#text" || plan.unsure.has(built)) continue;
		if (alignment.pairs.get(built) !== drawn) astray.push(`${built} = ${drawn}`);
	}
	return astray;
}

/** The match's plan, and the background's page it read. */
export interface Matched {
	plan: Plan;
	rendered: Rendered;
}

/**
 * The match's plan for a drawn page and a first patch, with the cells `held` as Lynx holds them;
 * undefined when it refuses.
 */
export function planFor(
	root: DrawnNode,
	patch: Patch,
	held: ReadonlySet<number>,
): Matched | undefined {
	const rendered = readRendered(patch.items, patch.rendered ?? 0);
	const lists = new Map<number, DrawnNode>();
	const walk = (node: DrawnNode): void => {
		if (node.cells) lists.set(node.id, node);
		for (const child of elementsOf(node.children)) walk(child);
		for (const cell of node.cells ?? []) if (cell.node) walk(cell.node);
	};
	walk(root);
	const plan = matchFrame({
		root,
		rendered,
		lists: {
			held(list) {
				const cells = new Map<number, { bound: boolean }>();
				for (const cell of lists.get(list)?.cells ?? [])
					if (held.has(cell.id)) cells.set(cell.id, { bound: true });
				return cells;
			},
		},
	});
	return "mismatch" in plan ? undefined : { plan, rendered };
}

/** The drawn cells Lynx holds: those whose markup it asked for. */
export function heldCells(root: DrawnNode): Set<number> {
	const held = new Set<number>();
	const walk = (node: DrawnNode): void => {
		for (const child of elementsOf(node.children)) walk(child);
		for (const cell of node.cells ?? [])
			if (cell.node) {
				held.add(cell.id);
				walk(cell.node);
			}
	};
	walk(root);
	return held;
}
