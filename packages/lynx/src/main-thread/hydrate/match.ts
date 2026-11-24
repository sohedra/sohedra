// Hydration's match: the first frame's drawn tree against the page the background rendered, by
// position and kind, and a list's cells by key. It decides everything before anything changes, and
// returns either what to do or the first difference that refuses hydration.
//
// What may differ, and is written over the first frame:
//   - a text;
//   - the branches of Svelte's `{#if}` blocks: the first frame and the background may take another
//     branch there, as `{#if background}` does. Of a run of them, the elements that have the same
//     tags in the same places from its end and from its start are adopted, with what differs
//     written, in the cells of a list among them too; the rest is made again in place;
//   - events, styles set from code, and what the first mount's effects changed: none of them is in
//     the first frame.
// What refuses hydration (a mismatch): outside a block, a tag that differs, an element that one
// side has and the other lacks, or an attribute that differs; and a list whose keys differ.
// Outside a block, an attribute that differs only in `$props.id()`'s ids is written over the first
// frame's, and kept for a development build's warning: the ids agree unless a component only one
// thread renders is in a branch whose test the build does not recognize as one, or a component
// binding renders the first frame twice. Inside a block, an id that differs is written over with
// no warning, as any attribute there is.

import { MAIN_THREAD_PREFIX, PROPS_ID } from "../../wire/index.ts";
import type { AttrValue, HydrationMismatch, PropsIdDifference } from "../../wire/index.ts";
import { elementsOf, isBlock } from "../frame/html.ts";
import type { DrawnChild, DrawnNode } from "../frame/html.ts";
import { readCell } from "./rendered.ts";
import type { Rendered, RenderedNode } from "./rendered.ts";

/** A list the background keeps: its drawn cells by index, adopted, let go of, or left to wait. */
export interface ListPlan {
	id: number;
	drawn: number;
	items: number[];
	/** For each item, the drawn cell whose element it keeps (one Lynx holds), or none. */
	cells: (number | undefined)[];
}

/** A list inside a cell, whose items are its children: it keeps its state under the new ids. */
export interface NestedListPlan {
	id: number;
	drawn: number;
}

/** A run of drawn children made again in place from the background's. */
export interface Repair {
	/** The parent, by the background's id and the first frame's. */
	parent: number;
	drawnParent: number;
	/** The background's nodes to make, in order. */
	make: number[];
	/** The drawn nodes to take off. */
	drop: number[];
}

/** The texts of a parent made again in place: the frame drew others, or not as many. */
export interface TextRepair {
	drawnParent: number;
	/** The drawn texts to take off. */
	drop: number[];
	/** The background's texts to make. */
	make: number[];
	parent: number;
}

/** What hydration does. */
export interface Plan {
	/** Each drawn node the page keeps, with the background's id: [background, drawn]. */
	adopt: [number, number][];
	/** Attributes and texts of adopted nodes that differ, written over them. */
	writes: { id: number; name: string | null; value: AttrValue }[];
	lists: ListPlan[];
	nestedLists: NestedListPlan[];
	repairs: Repair[];
	textRepairs: TextRepair[];
	/** The cells adopted, whose rendered text the page does not need. */
	adoptedCells: Set<number>;
	/** Attributes outside a block whose ids of `$props.id()` differ, written over the first frame's. */
	propsIds: PropsIdDifference[];
}

/** Hydration was refused: what differs. */
export interface Refused {
	mismatch: HydrationMismatch;
}

/** What the match reads of the first frame's lists: which cells have elements, and which Lynx holds. */
export interface DrawnLists {
	held(list: number): Map<number, { bound: boolean }>;
}

class Mismatch extends Error {
	readonly mismatch: HydrationMismatch;

	constructor(mismatch: HydrationMismatch) {
		super(mismatch.kind);
		this.mismatch = mismatch;
	}
}

/** `style` text as compared: spaces and the last `;` do not count. */
const styleText = (value: string): string => value.replace(/\s+/g, "").replace(/;$/, "");

function same(name: string, a: AttrValue | undefined, b: AttrValue | undefined): boolean {
	if (a === b) return true;
	if (a === undefined || b === undefined || a === null || b === null) return false;
	if (typeof a === "object" || typeof b === "object")
		return JSON.stringify(a) === JSON.stringify(b);
	if (name === "style") return styleText(String(a)) === styleText(String(b));
	return String(a) === String(b);
}

/**
 * Whether two values differ only in the ids of `$props.id()`: then the background's are written
 * over the frame's, and the page goes on.
 */
const sameButIds = (a: string, b: string): boolean =>
	a.replace(PROPS_ID, "") === b.replace(PROPS_ID, "");

/** An item key as text: Lynx reads it as text. */
const keyText = (key: unknown): string =>
	typeof key === "string" ? key : (JSON.stringify(key) ?? "");

/** The attributes compared: those of a main-thread function are its runtime's. */
const compared = (name: string): boolean => !name.startsWith(MAIN_THREAD_PREFIX);

/**
 * Whether a value is the same as no attribute: an empty class, which Svelte's server writes beside
 * a spread and its client does not set, is no class to Lynx.
 */
const asNone = (name: string, value: AttrValue | undefined): boolean =>
	value === undefined || (name === "class" && value === "");

/** Matches the drawn page against the rendered one. */
export function matchFrame(options: {
	root: DrawnNode;
	rendered: Rendered;
	lists: DrawnLists;
}): Plan | Refused {
	const { root, rendered, lists } = options;
	const plan: Plan = {
		adopt: [],
		writes: [],
		lists: [],
		nestedLists: [],
		repairs: [],
		textRepairs: [],
		adoptedCells: new Set(),
		propsIds: [],
	};
	const node = (id: number): RenderedNode => rendered.nodes.get(id)!;
	const isText = (id: number): boolean => node(id).tag === "#text";
	/** The rendered children that are elements: texts are matched on their own. */
	const elementChildren = (id: number): number[] =>
		node(id).children.filter((child) => !isText(child));
	/** The drawn elements of `children`, blocks opened, texts left out. */
	const drawnElements = (children: DrawnChild[]): DrawnNode[] =>
		elementsOf(children).filter((child) => child.tag !== "#text");

	/** Whether the two have the same tags in the same places, all the way down. */
	function sameShape(id: number, drawn: DrawnNode): boolean {
		const built = node(id);
		if (built.tag !== drawn.tag) return false;
		if (drawn.cells)
			return keysOf(drawn).join("\n") === (built.list?.keys ?? []).map(keyText).join("\n");
		const children = drawnElements(drawn.children);
		const builtChildren = elementChildren(id);
		return (
			children.length === builtChildren.length &&
			children.every((child, index) => sameShape(builtChildren[index]!, child))
		);
	}

	function keysOf(drawn: DrawnNode): string[] {
		return (drawn.cells ?? []).map((cell) => keyText(cell.attrs.get("item-key")));
	}

	/** Compares a pair of the same tag, and what is under it. */
	function pair(id: number, drawn: DrawnNode, inBlock: boolean): void {
		const built = node(id);
		plan.adopt.push([id, drawn.id]);
		if (built.tag === "#text") {
			if (built.text !== drawn.text) plan.writes.push({ id, name: null, value: built.text });
			return;
		}
		for (const [name, value] of built.attrs) {
			const got = drawn.attrs.get(name);
			if (!compared(name) || same(name, value, got)) continue;
			if (asNone(name, value) && asNone(name, got)) continue;
			if (!inBlock) {
				if (typeof value !== "string" || typeof got !== "string" || !sameButIds(value, got))
					throw new Mismatch({ kind: "attribute", element: id, name, expected: value, got });
				plan.propsIds.push({ element: id, name, expected: value, got });
			}
			plan.writes.push({ id, name, value });
		}
		for (const [name, value] of drawn.attrs) {
			if (!compared(name) || built.attrs.has(name) || asNone(name, value)) continue;
			if (!inBlock)
				throw new Mismatch({
					kind: "attribute",
					element: id,
					name,
					expected: undefined,
					got: value,
				});
			plan.writes.push({ id, name, value: null });
		}
		if (drawn.cells) {
			list(id, drawn, inBlock);
			return;
		}
		if (drawn.tag === "list") plan.nestedLists.push({ id, drawn: drawn.id });
		align(id, drawn, inBlock);
	}

	/** A list's cells by key; in a block, as the list is, so their attributes may differ too. */
	function list(id: number, drawn: DrawnNode, inBlock: boolean): void {
		const built = node(id);
		const keys = (built.list?.keys ?? []).map(keyText);
		const got = keysOf(drawn);
		if (keys.join("\n") !== got.join("\n"))
			throw new Mismatch({ kind: "list-keys", element: id, expected: keys, got });
		const items = built.list?.items ?? [];
		const held = lists.held(drawn.id);
		const cells: (number | undefined)[] = [];
		for (let index = 0; index < items.length; index++) {
			const cell = drawn.cells![index]!;
			const state = held.get(cell.id);
			// Only the cells Lynx holds keep their elements; one it handed back is let go of.
			if (!state || !state.bound || !cell.node) {
				cells.push(undefined);
				continue;
			}
			const item = items[index]!;
			if (readCell(rendered, item)?.tag !== "list-item")
				throw new Mismatch({ kind: "extra", element: id, got: "list-item" });
			cells.push(cell.id);
			plan.adoptedCells.add(item);
			pair(item, cell.node, inBlock);
		}
		plan.lists.push({ id, drawn: drawn.id, items, cells });
	}

	/**
	 * Matches a parent's texts, which never refuse. Texts go by the element they follow: where both
	 * sides have as many there, one to one; else the drawn ones are taken off and the background's
	 * made in place. Where the two sides have a different number of elements, every text is made
	 * again: an element adopted from a run keeps its drawn place, which a drawn text may be on the
	 * wrong side of.
	 */
	function texts(id: number, drawn: DrawnNode): void {
		const children = node(id).children;
		const drawnChildren = elementsOf(drawn.children);
		/** The texts of a list of children, by how many elements come before them. */
		const bySlot = <T>(list: T[], text: (child: T) => boolean): T[][] => {
			const slots: T[][] = [[]];
			for (const child of list) {
				if (text(child)) slots[slots.length - 1]!.push(child);
				else slots.push([]);
			}
			return slots;
		};
		const built = bySlot(children, isText);
		const drawnTexts = bySlot(drawnChildren, (child) => child.tag === "#text");
		const aligned = built.length === drawnTexts.length;
		if (!aligned) {
			built.splice(0, built.length, built.flat());
			drawnTexts.splice(0, drawnTexts.length, drawnTexts.flat());
		}
		for (let slot = 0; slot < built.length; slot++) {
			const ours = built[slot]!;
			const theirs = drawnTexts[slot]!;
			if (aligned && ours.length === theirs.length) {
				for (let index = 0; index < ours.length; index++) pair(ours[index]!, theirs[index]!, true);
				continue;
			}
			plan.textRepairs.push({
				parent: id,
				drawnParent: drawn.id,
				drop: theirs.map((text) => text.id),
				make: ours,
			});
		}
	}

	/** Matches a parent's children: drawn elements outside blocks one to one, blocks by run. */
	function align(id: number, drawn: DrawnNode, inBlock: boolean): void {
		texts(id, drawn);
		const built = elementChildren(id);
		// The drawn elements as fixed nodes, and runs that may differ: Svelte's `{#if}` branches.
		const parts: (DrawnNode | DrawnChild[])[] = [];
		for (const child of drawn.children) {
			if (!isBlock(child) && child.tag === "#text") continue;
			const last = parts[parts.length - 1];
			if (!isBlock(child)) parts.push(child);
			else if (Array.isArray(last)) last.push(child);
			else parts.push([child]);
		}
		const runs = parts.filter((part) => Array.isArray(part)).length;
		if (runs > 1) {
			// Several runs: from the first to the last is one, so that each side's length is known.
			const first = parts.findIndex((part) => Array.isArray(part));
			let last = parts.length - 1;
			while (!Array.isArray(parts[last])) last--;
			const merged = parts
				.slice(first, last + 1)
				.flatMap((part) => (Array.isArray(part) ? part : [part]));
			parts.splice(first, last - first + 1, merged);
		}
		const fixed = parts.filter((part) => !Array.isArray(part)).length;
		const free = built.length - fixed;
		if (free < 0 || (runs === 0 && free > 0)) {
			const extra = free < 0;
			const at = extra ? undefined : built[fixed];
			if (inBlock) throw new Mismatch({ kind: "tag", element: id });
			throw new Mismatch(
				extra
					? { kind: "extra", element: id, got: firstFixedBeyond(parts, built, node) }
					: { kind: "missing", element: at!, expected: node(at!).tag },
			);
		}
		let index = 0;
		for (const part of parts) {
			if (!Array.isArray(part)) {
				const builtId = built[index++]!;
				if (node(builtId).tag !== part.tag) {
					if (inBlock) throw new Mismatch({ kind: "tag", element: builtId });
					throw new Mismatch({
						kind: "tag",
						element: builtId,
						expected: node(builtId).tag,
						got: part.tag,
					});
				}
				pair(builtId, part, inBlock);
				continue;
			}
			const make = built.slice(index, index + free);
			index += free;
			run(id, drawn.id, { make, drawn: drawnElements(part) });
		}
	}

	/**
	 * A run that may differ: what has the same shape from its end and from its start is adopted,
	 * and what is left between is made again in place.
	 */
	function run(
		id: number,
		drawnParent: number,
		{ make, drawn }: { make: number[]; drawn: DrawnNode[] },
	): void {
		const most = Math.min(make.length, drawn.length);
		// From the end first: a part only the background renders, `{#if background}`, comes first
		// more often than last.
		let end = 0;
		while (end < most && sameShape(make[make.length - 1 - end]!, drawn[drawn.length - 1 - end]!))
			end++;
		let start = 0;
		while (start < most - end && sameShape(make[start]!, drawn[start]!)) start++;
		for (let index = 0; index < start; index++) pair(make[index]!, drawn[index]!, true);
		for (let index = 1; index <= end; index++)
			pair(make[make.length - index]!, drawn[drawn.length - index]!, true);
		const left = make.slice(start, make.length - end);
		const dropped = drawn.slice(start, drawn.length - end);
		if (left.length === 0 && dropped.length === 0) return;
		plan.repairs.push({
			parent: id,
			drawnParent,
			make: left,
			drop: dropped.map((child) => child.id),
		});
	}

	try {
		align(root.id, root, false);
		return plan;
	} catch (error) {
		if (error instanceof Mismatch) return { mismatch: error.mismatch };
		throw error;
	}
}

/** The tag of the first drawn element the background has no place for. */
function firstFixedBeyond(
	parts: (DrawnNode | DrawnChild[])[],
	built: number[],
	node: (id: number) => RenderedNode,
): string {
	let index = 0;
	for (const part of parts) {
		if (Array.isArray(part)) continue;
		const id = built[index++];
		if (id === undefined || node(id).tag !== part.tag) return part.tag;
	}
	return "";
}
