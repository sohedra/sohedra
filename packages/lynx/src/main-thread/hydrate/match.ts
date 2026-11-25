// Hydration's match: the first frame's drawn tree against the page the background rendered, by
// block and position, and a list's cells by key. It decides everything before anything changes, and
// returns either what to do or the first difference that refuses hydration.
//
// Svelte numbers every branch of every `{#if}` on both threads. The first frame's markup says which
// one it drew (`<!--[0-->`), and the rendered items which one the background rendered (branch
// marks). A parent's children are a sequence of entries, elements and blocks; texts are matched on
// their own. Two sequences line up when they are as long, with an element of the same tag against
// each element and a block against each block. A block's content is compared only when both
// threads took the same branch; a block that took another is made again in place, never paired
// across. A block's second state (a list's `{:else}`, an `{#await}` given a value, a boundary's
// `pending`) is a block too, and so is the place of an `{#await}` given a promise, whose branch the
// background draws after the rendered items; a second state with nothing in it is no entry.
//
// What may differ, and is written over the first frame or made again in place:
//   - a text;
//   - inside a block, an attribute: hydration is not sure of the element it wrote over, nor of
//     what is under it (`Plan.unsure`), and replays no early event there;
//   - inside a block, a sequence that does not line up, or a list whose keys differ: the block's
//     content, or the parent's children, are made again whole, and none of it is adopted;
//   - a parent's children that hold a block, on either side, and do not line up: made again whole;
//   - a parent's children whose marks cannot be read: made again whole, lined up or not;
//   - events, styles set from code, and what the first mount's effects changed: none of them is in
//     the first frame.
// What refuses hydration (a mismatch), outside every block: a parent's children that hold no block
// and do not line up, an attribute that differs, and a list whose keys differ. An attribute that differs only in
// `$props.id()`'s ids is written over the first frame's, and kept for a development build's
// warning: the ids agree unless a component only one thread renders is in a branch whose test the
// build does not recognize as one, or a component binding renders the first frame twice. Inside a
// block, an id that differs is written over with no warning, and hydration stays sure.

import { BranchKey, MAIN_THREAD_PREFIX, PROPS_ID } from "../../wire/index.ts";
import type { AttrValue, HydrationMismatch, PropsIdDifference } from "../../wire/index.ts";
import { elementsOf, isBlock } from "../frame/html.ts";
import type { DrawnBlock, DrawnChild, DrawnNode } from "../frame/html.ts";
import { entriesOf, readCell } from "./rendered.ts";
import type { Rendered, RenderedBlock, RenderedEntry, RenderedNode } from "./rendered.ts";

/** A list the background keeps: its drawn cells by index, adopted, let go of, or left to wait. */
interface ListPlan {
	id: number;
	drawn: number;
	items: number[];
	/** For each item, the drawn cell whose element it keeps (one Lynx holds), or none. */
	cells: (number | undefined)[];
}

/** A list inside a cell, whose items are its children: it keeps its state under the new ids. */
interface NestedListPlan {
	id: number;
	drawn: number;
}

/** Drawn children made again in place from the background's. */
interface Repair {
	/** The parent, by the background's id and the first frame's. */
	parent: number;
	drawnParent: number;
	/** The background's nodes to make, in order. */
	make: number[];
	/** The drawn nodes to take off. */
	drop: number[];
}

/** The texts of a parent made again in place: the frame drew others, or not as many. */
interface TextRepair {
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
	/**
	 * The adopted elements hydration wrote an attribute over, but an id of `$props.id()`, and what is
	 * under them.
	 */
	unsure: Set<number>;
}

/** Hydration was refused: what differs. */
export interface Refused {
	mismatch: HydrationMismatch;
}

/** What the match reads of the first frame's lists: which cells have elements, and which Lynx holds. */
interface DrawnLists {
	held(list: number): Map<number, { bound: boolean }>;
}

class Mismatch extends Error {
	readonly mismatch: HydrationMismatch;

	constructor(mismatch: HydrationMismatch) {
		super(mismatch.kind);
		this.mismatch = mismatch;
	}
}

/** One entry of a sequence on the background's side: an element's id, or a block. */
type Built = number | RenderedBlock;
/** One entry on the first frame's side. */
type Drawn = DrawnNode | DrawnBlock;

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
const sameButIds = (a: AttrValue | undefined, b: AttrValue | undefined): boolean =>
	typeof a === "string" &&
	typeof b === "string" &&
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
		unsure: new Set(),
	};
	const node = (id: number): RenderedNode => rendered.nodes.get(id)!;
	const isText = (id: number): boolean => node(id).tag === "#text";

	/** The entries of a sequence that are compared: texts left out, a second state with none too. */
	function builtEntries(entries: RenderedEntry[]): Built[] {
		const out: Built[] = [];
		for (const entry of entries) {
			if (typeof entry === "number") {
				if (!isText(entry)) out.push(entry);
			} else if (entry.key !== BranchKey.Second || builtEntries(entry.entries).length > 0)
				out.push(entry);
		}
		return out;
	}

	function drawnEntries(children: DrawnChild[]): Drawn[] {
		const out: Drawn[] = [];
		for (const child of children) {
			if (!isBlock(child)) {
				if (child.tag !== "#text") out.push(child);
			} else if (child.key !== BranchKey.Second || drawnEntries(child.children).length > 0)
				out.push(child);
		}
		return out;
	}

	/** The background's elements of a sequence, blocks opened. */
	function builtElements(entries: Built[], out: number[] = []): number[] {
		for (const entry of entries) {
			if (typeof entry === "number") out.push(entry);
			else builtElements(builtEntries(entry.entries), out);
		}
		return out;
	}

	/** The first frame's elements of a sequence, blocks opened. */
	const drawnElements = (entries: Drawn[]): DrawnNode[] =>
		elementsOf(entries).filter((child) => child.tag !== "#text");

	/** Whether two sequences line up: as long, with the same tag at each element, a block at each block. */
	function linesUp(built: Built[], drawn: Drawn[]): boolean {
		if (built.length !== drawn.length) return false;
		for (let index = 0; index < built.length; index++) {
			const ours = built[index]!;
			const theirs = drawn[index]!;
			if (typeof ours === "number") {
				if (isBlock(theirs) || node(ours).tag !== theirs.tag) return false;
			} else if (!isBlock(theirs)) return false;
		}
		return true;
	}

	/** Makes a sequence again in place: the background's elements made, the drawn taken off. */
	function remake(id: number, drawnId: number, built: Built[], drawn: Drawn[]): void {
		const make = builtElements(built);
		const drop = drawnElements(drawn).map((child) => child.id);
		if (make.length > 0 || drop.length > 0)
			plan.repairs.push({ parent: id, drawnParent: drawnId, make, drop });
	}

	/** The first difference of a parent's children that hold no block, as a mismatch. */
	function refusal(id: number, built: Built[], drawn: Drawn[]): Mismatch {
		const ours = builtElements(built);
		const theirs = drawnElements(drawn);
		// With no block on either side, the two differ in an element: the loop ends there.
		for (let index = 0; ; index++) {
			const mine = ours[index];
			const yours = theirs[index];
			if (mine === undefined)
				return new Mismatch({ kind: "extra", element: id, got: yours?.tag ?? "" });
			if (yours === undefined)
				return new Mismatch({ kind: "missing", element: mine, expected: node(mine).tag });
			if (node(mine).tag !== yours.tag)
				return new Mismatch({
					kind: "tag",
					element: mine,
					expected: node(mine).tag,
					got: yours.tag,
				});
		}
	}

	/** What the plan lists, in the order `rewind` takes their lengths. */
	const listed: unknown[][] = [
		plan.adopt,
		plan.writes,
		plan.lists,
		plan.nestedLists,
		plan.repairs,
		plan.textRepairs,
	];

	/** Forgets what the plan holds past `at`: a block's content that is made again after all. */
	function rewind(at: number[]): void {
		for (const [id] of plan.adopt.slice(at[0])) {
			plan.unsure.delete(id);
			plan.adoptedCells.delete(id);
		}
		listed.forEach((list, index) => (list.length = at[index]!));
	}

	/**
	 * Pairs two sequences that line up: elements as they are, blocks by their branch. `inBlock`:
	 * the sequence is inside a block.
	 */
	function sequence(
		id: number,
		drawnId: number,
		built: Built[],
		drawn: Drawn[],
		inBlock: boolean,
		over: boolean,
	): void {
		for (let index = 0; index < built.length; index++) {
			const ours = built[index]!;
			const theirs = drawn[index]!;
			if (typeof ours === "number") {
				// Boundary: the sequences line up, so an element is against an element.
				pair(ours, theirs as DrawnNode, inBlock, over);
				continue;
			}
			// Boundary: as above, a block against a block.
			const block = theirs as DrawnBlock;
			const content = builtEntries(ours.entries);
			const drawnContent = drawnEntries(block.children);
			if (ours.key !== block.key || !linesUp(content, drawnContent)) {
				remake(id, drawnId, content, drawnContent);
				continue;
			}
			// What differs deeper, a list's keys, is made again with the block's content.
			const at = listed.map((list) => list.length);
			try {
				sequence(id, drawnId, content, drawnContent, true, over);
			} catch (error) {
				if (!(error instanceof Mismatch)) throw error;
				rewind(at);
				remake(id, drawnId, content, drawnContent);
			}
		}
	}

	/** A parent's children: its texts, then its entries. */
	function children(id: number, drawn: DrawnNode, inBlock: boolean, over: boolean): void {
		texts(id, drawn);
		const entries = entriesOf(node(id));
		const drawnChildren = drawnEntries(drawn.children);
		// Marks that cannot be read: nothing under the parent is adopted.
		if (entries === null) {
			remake(id, drawn.id, builtEntries(node(id).children), drawnChildren);
			return;
		}
		const built = builtEntries(entries);
		if (linesUp(built, drawnChildren)) {
			sequence(id, drawn.id, built, drawnChildren, inBlock, over);
			return;
		}
		const explained =
			inBlock || built.some((entry) => typeof entry !== "number") || drawnChildren.some(isBlock);
		if (!explained) throw refusal(id, built, drawnChildren);
		remake(id, drawn.id, built, drawnChildren);
	}

	/** Compares a pair of the same tag, and what is under it. */
	function pair(id: number, drawn: DrawnNode, inBlock: boolean, over = false): void {
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
			const ids = sameButIds(value, got);
			if (!inBlock) {
				if (!ids)
					throw new Mismatch({ kind: "attribute", element: id, name, expected: value, got });
				// Boundary: `sameButIds` holds of two strings only.
				plan.propsIds.push({ element: id, name, expected: value as string, got: got as string });
			}
			plan.writes.push({ id, name, value });
			if (!ids) plan.unsure.add(id);
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
			plan.unsure.add(id);
		}
		// What is under an element written over is not sure either.
		if (over) plan.unsure.add(id);
		else over = plan.unsure.has(id);
		if (drawn.cells) {
			list(id, drawn, inBlock, over);
			return;
		}
		if (drawn.tag === "list") plan.nestedLists.push({ id, drawn: drawn.id });
		children(id, drawn, inBlock, over);
	}

	/** A list's cells by key; in a block, as the list is, so their attributes may differ too. */
	function list(id: number, drawn: DrawnNode, inBlock: boolean, over: boolean): void {
		const built = node(id);
		const keys = (built.list?.keys ?? []).map(keyText);
		const got = (drawn.cells ?? []).map((cell) => keyText(cell.attrs.get("item-key")));
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
			pair(item, cell.node, inBlock, over);
		}
		plan.lists.push({ id, drawn: drawn.id, items, cells });
	}

	/**
	 * Matches a parent's texts, which never refuse, with its blocks' texts as its own. Texts go by
	 * the element they follow: where both sides have as many there, one to one; else the drawn ones
	 * are taken off and the background's made in place. Where the two sides have a different number
	 * of elements, every text is made again.
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

	try {
		children(root.id, root, false, false);
		return plan;
	} catch (error) {
		if (error instanceof Mismatch) return { mismatch: error.mismatch };
		throw error;
	}
}
