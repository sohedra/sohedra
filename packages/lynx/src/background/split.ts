// Splits the renderer's ops into what the main thread applies now and what waits in a list cell.
//
// The main thread asks a Lynx list for a cell synchronously, so it must hold the cell's ops before
// the list shows it; the main thread also runs JavaScript several times slower than the
// background. So:
//   - an element's ops wait here until it is inserted under something sent, and nothing is sent
//     for an element that never is;
//   - a cell of a list that is not itself inside a cell, and everything in it, goes in the cell's
//     own item, as text the main thread keeps unparsed until the list shows the cell;
//   - such a list's items (their order, their info) are tracked here, and each batch ends with one
//     `ListUpdate` op per list that changed;
//   - a cell held back (a deferred row whose contents have not rendered, or whose text the main
//     thread let go of) sends nothing: it is written whole when it is asked for.
//
// Applied in order, the items do what the ops did.

import { LIST_ITEM_INFO, listUpdateInfo, OpCode, Order } from "../wire/index.ts";
import type { AttrValue, CellItem, ListItemInfo, Op, OpsItem } from "../wire/index.ts";

/** An item of a patch the splitter writes. */
export type SplitItem = OpsItem | CellItem;

interface Pending {
	create: Op;
	ops: Op[];
}

interface ListState {
	items: Order;
	committed: number[];
	/** The cells whose info changed since the last update. */
	changed: Set<number>;
	dirty: boolean;
}

/** Turns batches of ops into a patch's items. */
export interface Splitter {
	split(ops: Op[]): SplitItem[];
	/** Whether the cell is held back: none of its ops is sent. */
	holds(id: number): boolean;
	/** Holds the cell back from now on: the main thread let go of its text. */
	hold(id: number): void;
	/** The cell was written whole, outside the splitter: its ops are sent again. */
	written(id: number): void;
}

/**
 * Makes a splitter; `encode` writes a cell's ops as the text of its item, and `waits` says whether
 * a new cell of a list of the page is held back until it is asked for.
 */
export function createSplitter(
	encode: (ops: Op[]) => string,
	waits?: (id: number) => boolean,
): Splitter {
	// Made, not inserted under anything sent yet.
	const pending = new Map<number, Pending>();
	// The children of pending elements, in order, and the pending element each child is placed in:
	// a new child is appended without a search, so a pending list of n rows costs O(n).
	const kids = new Map<number, number[]>();
	const placedIn = new Map<number, number>();
	// The sent elements that live in a cell's item, and that cell (a cell is its own).
	const owner = new Map<number, number>();
	const lists = new Set<number>();
	// The lists that are not inside a cell, whose items are tracked here.
	const tracked = new Map<number, ListState>();
	// The info of the cells of tracked lists, and the list each cell is in.
	const infos = new Map<number, ListItemInfo>();
	const listOf = new Map<number, number>();
	// The cells held back.
	const held = new Set<number>();

	let items: SplitItem[] = [];
	let current = 0;
	let ops: Op[] = [];

	function close(): void {
		if (ops.length === 0) return;
		items.push(current === 0 ? ["ops", ops] : ["cell", current, encode(ops)]);
		ops = [];
	}

	function to(cell: number, op: Op): void {
		if (held.has(cell)) return;
		if (cell !== current) {
			close();
			current = cell;
		}
		ops.push(op);
	}

	const isInfo = (op: Op): op is [typeof OpCode.SetAttr, number, string, AttrValue] =>
		op[0] === OpCode.SetAttr && LIST_ITEM_INFO.has(op[2]);

	function take(id: number): Pending | undefined {
		const entry = pending.get(id);
		if (entry) pending.delete(id);
		return entry;
	}

	/** Sends a pending subtree into `cell`'s item (0: the page). */
	function materialize(id: number, cell: number): void {
		const entry = take(id);
		if (!entry) return;
		if (cell !== 0) owner.set(id, cell);
		to(cell, entry.create);
		for (const op of entry.ops) to(cell, op);
		const children = kids.get(id);
		if (!children) return;
		kids.delete(id);
		const cellsHere = cell === 0 && lists.has(id);
		for (const child of children) {
			placedIn.delete(child);
			if (cellsHere) {
				addCell(id, child, 0);
				continue;
			}
			materialize(child, cell);
			to(cell, [OpCode.Insert, id, child, 0]);
		}
	}

	function setInfo(id: number, key: string, value: unknown): void {
		let info = infos.get(id);
		if (!info) infos.set(id, (info = {}));
		if (value == null) delete info[key];
		else info[key] = value;
		const list = tracked.get(listOf.get(id) ?? 0);
		if (list) {
			list.changed.add(id);
			list.dirty = true;
		}
	}

	function trackedList(id: number): ListState {
		let list = tracked.get(id);
		if (!list) {
			list = { items: new Order(), committed: [], changed: new Set(), dirty: false };
			tracked.set(id, list);
		}
		return list;
	}

	/** Inserts or moves a cell of a tracked list; what is in it goes into its own item. */
	function addCell(listId: number, id: number, anchor: number): void {
		const entry = take(id);
		if (entry) {
			for (const op of entry.ops) if (isInfo(op)) setInfo(id, op[2], op[3]);
			if (waits?.(id)) held.add(id);
			owner.set(id, id);
			pending.set(id, entry);
			materialize(id, id);
		}
		const list = trackedList(listId);
		list.items.delete(id);
		list.items.insert(id, anchor);
		listOf.set(id, listId);
		list.dirty = true;
	}

	/** Takes a cell out of a tracked list. */
	function removeCell(list: ListState, id: number): void {
		list.items.delete(id);
		listOf.delete(id);
		list.dirty = true;
	}

	/** One `ListUpdate` per list that changed, at the end of the batch. */
	function updateLists(): void {
		for (const [id, list] of tracked) {
			if (!list.dirty) continue;
			const now = list.items.toArray();
			const before = new Set(list.committed);
			const after = new Set(now);
			const added = now.filter((item) => !before.has(item));
			const removed = list.committed.filter((item) => !after.has(item));
			const info = listUpdateInfo({
				committed: list.committed,
				items: now,
				infos,
				changed: list.changed,
			});
			to(0, [OpCode.ListUpdate, id, info, now, added, removed]);
			list.committed = now;
			list.changed.clear();
			list.dirty = false;
		}
	}

	function place(parent: number, child: number, anchor: number): void {
		let children = kids.get(parent);
		if (!children) kids.set(parent, (children = []));
		if (placedIn.get(child) === parent) children.splice(children.indexOf(child), 1);
		placedIn.set(child, parent);
		const before = anchor === 0 ? -1 : children.indexOf(anchor);
		if (before === -1) children.push(child);
		else children.splice(before, 0, child);
	}

	function splitOne(op: Op): void {
		switch (op[0]) {
			case OpCode.Create:
				if (op[2] === "list") lists.add(op[1]);
				pending.set(op[1], { create: op, ops: [] });
				return;
			case OpCode.CreateText:
				pending.set(op[1], { create: op, ops: [] });
				return;
			case OpCode.SetText:
			case OpCode.SetAttr:
			case OpCode.SetEvent:
			case OpCode.SetStyles:
			case OpCode.Animate: {
				const entry = pending.get(op[1]);
				if (entry) {
					entry.ops.push(op);
					return;
				}
				const cell = owner.get(op[1]) ?? 0;
				if (cell === op[1] && isInfo(op)) setInfo(cell, op[2], op[3]);
				to(cell, op);
				return;
			}
			case OpCode.Insert: {
				const [, parent, child, anchor] = op;
				if (pending.has(parent)) {
					place(parent, child, anchor);
					return;
				}
				const cell = owner.get(parent) ?? 0;
				if (cell === 0 && lists.has(parent)) {
					addCell(parent, child, anchor);
					return;
				}
				materialize(child, cell);
				to(cell, op);
				return;
			}
			case OpCode.Remove: {
				const [, parent, child] = op;
				if (pending.has(parent)) {
					const children = kids.get(parent);
					const at = children ? children.indexOf(child) : -1;
					if (at !== -1) children!.splice(at, 1);
					placedIn.delete(child);
				} else if (tracked.has(parent)) {
					removeCell(tracked.get(parent)!, child);
				} else {
					to(owner.get(parent) ?? 0, op);
				}
				return;
			}
			case OpCode.Release: {
				const id = op[1];
				lists.delete(id);
				tracked.delete(id);
				infos.delete(id);
				placedIn.delete(id);
				held.delete(id);
				if (pending.delete(id)) {
					kids.delete(id);
					return;
				}
				const cell = owner.get(id) ?? 0;
				owner.delete(id);
				// A cell's own release goes to the page, where the list forgets it.
				to(cell === id ? 0 : cell, op);
				return;
			}
			case OpCode.ListUpdate:
				// Only this splitter writes it.
				to(0, op);
		}
	}

	return {
		split(input) {
			items = [];
			current = 0;
			ops = [];
			for (const op of input) splitOne(op);
			updateLists();
			close();
			return items;
		},
		holds: (id) => held.has(id),
		hold(id) {
			if (owner.get(id) === id) held.add(id);
		},
		written(id) {
			held.delete(id);
		},
	};
}
