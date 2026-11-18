// Lynx's `<list>`. A list makes its cells on demand: it is told which items it has through its
// `update-list-info` (the items inserted, removed and updated since the last time, each with its
// `item-key`), asks for the element at an index when a cell scrolls into view (`componentAtIndex`)
// and hands it back when the cell scrolls out (`enqueueComponent`)
// (core/runtime/lepus/bindings/renderer_functions.cc, FiberCreateList).
//
// For a list of the page, the background tracks the items and sends the update ready
// (`ListUpdate`). A cell's element and what is in it are made only when Lynx first asks for the
// cell: the ops the main thread kept for it are applied then. The cell is then in the list, so
// asking again gives the same element. A cell that is no longer an item leaves the list once Lynx
// no longer shows it.
//
// A list of the page keeps about a screen of the cells Lynx handed back with their elements. Past
// that, on a later task and never inside Lynx's callback, it asks the background to write the
// oldest again; when that text comes, a cell Lynx still has not taken back leaves the list and its
// elements are let go of, which frees their views, and the text is kept for the next time Lynx
// asks. A cell never shown whose kept text piled up is asked for the same way.
//
// A list inside a cell is rare: its items come as inserts and removals, and its update is written
// here. It keeps its cells, and goes with the cell it is in.

import { listUpdateInfo, Order } from "../wire/index.ts";
import type { ListItemInfo, ListUpdateInfo } from "../wire/index.ts";
import { mainThread } from "./globals.ts";
import type {
	ComponentAtIndex,
	ComponentAtIndexes,
	EnqueueComponent,
	LynxElement,
} from "./globals.ts";

/** The item attributes only the list reads, which are not set on the item's element. */
export const LIST_ONLY_INFO: ReadonlySet<string> = new Set(["reuse-identifier", "recyclable"]);

/**
 * The fewest cells Lynx handed back that a list keeps with their elements. Lynx holds a screen of
 * cells and `preload-buffer-count` more on each side (9, 19 and 49 cells at 0, 5 and 20 on an iOS
 * device, with rows of 15 elements), so what it holds less twice that count is a screen of this
 * list's rows; a list keeps that many, and at least this: such a screen, rounded up.
 */
const KEPT_CELLS = 10;

interface Cell {
	id: number;
	/** `undefined` until the list first asks for the cell. */
	element: LynxElement | undefined;
	/** -1 while there is no element. */
	uid: number;
	/** In the list element. */
	attached: boolean;
	/** Lynx shows it: it asked for it and has not handed it back. */
	bound: boolean;
	/** No longer one of the list's items. */
	removed: boolean;
	/** The background was asked to write it again, and Lynx has not asked for it since. */
	asked: boolean;
}

const newCell = (id: number): Cell => ({
	id,
	element: undefined,
	uid: -1,
	attached: false,
	bound: false,
	removed: false,
	asked: false,
});

/** A list's own state: its element, its items and its cells. */
export interface ListState {
	element: LynxElement;
	/** The items in their order now. */
	items: Order;
	/** The items as Lynx last heard of them: its indexes are into this. */
	committed: number[];
	cells: Map<number, Cell>;
	cellsByUid: Map<number, Cell>;
	/** The items whose info changed since the last update. */
	changed: Set<number>;
	/** Whether its cells come as text of their own: one Lynx handed back can be let go of. */
	releases: boolean;
	/** The cells Lynx handed back that keep their elements, in the order it handed them back. */
	unbound: Set<Cell>;
	/** How many cells Lynx holds. */
	bound: number;
	/** Its `preload-buffer-count`. */
	preload: number;
}

/** A cell that has its element, with whether Lynx holds it now. */
export interface HeldCell {
	id: number;
	element: LynxElement;
	uid: number;
	attached: boolean;
	/** Lynx asked for it and has not handed it back. */
	bound: boolean;
}

/** A list's items under their new ids, with the cells whose elements they keep. */
export interface AdoptedItems {
	/** The items, in order. */
	items: number[];
	/** For each item, the cell whose element it keeps, or none. */
	cells: (HeldCell | undefined)[];
	/** The items as Lynx last heard of them, when that is not `items`. */
	committed?: number[];
	/**
	 * The items' info, for a list inside a cell, whose updates this module writes: its items are
	 * then this list's.
	 */
	infos?: Map<number, ListItemInfo>;
}

/** A list update the background wrote. */
export interface SentListUpdate {
	info: ListUpdateInfo;
	items: number[];
	added: number[];
	removed: number[];
}

/** What the lists need of the page. */
export interface ListsScope {
	/** The page's unique id, which elements are made with. */
	pageUid: number;
	/** Makes the cell with this id from what the main thread kept for it: Lynx waits for it. */
	openCell(id: number): void;
	/**
	 * Asks for `takeRewrites` on a later task, outside Lynx's callbacks: a list keeps more cells
	 * Lynx handed back than it should, or a cell was asked for. Without it, every cell is kept.
	 */
	schedule?: () => void;
	/** The Lynx element of an id, once made. */
	elementOf(id: number): LynxElement | undefined;
	report(error: unknown): void;
}

/** The page's lists. */
export interface Lists {
	create(id: number): LynxElement;
	isList(id: number): boolean;
	/** A list inside a cell: an item joins it, before `anchor` (0 appends), or moves. */
	insert(listId: number, item: { id: number; anchor: number }): void;
	/** A list inside a cell: an item leaves it. */
	remove(listId: number, itemId: number): void;
	/** A list of the page: the update the background wrote. */
	update(listId: number, change: SentListUpdate): void;
	/** An item's info changed (`LIST_ITEM_INFO`). */
	setInfo(id: number, info: { key: string; value: unknown }): void;
	/** The element with this id is gone: if it is a list, Lynx gets callbacks that do nothing. */
	release(id: number): void;
	/** The page is gone: Lynx gets no callbacks of it to call, in any list. */
	destroy(): void;
	/** Tells every list inside a cell whose items changed. */
	flush(): void;
	/** A list's `preload-buffer-count` is set. */
	setPreload(id: number, value: unknown): void;
	/**
	 * The cells to ask the background to write again: the oldest Lynx handed back past what each
	 * list keeps, and those `ask` named. They are marked asked.
	 */
	takeRewrites(): number[];
	/** A cell Lynx never showed is to be written again, at the next `takeRewrites`. */
	ask(id: number): void;
	/**
	 * The background wrote a cell again. `ignore`: not asked for, or Lynx asked for it since, and it
	 * keeps what it has. `keep`: its new text replaces what was kept. `release`: as `keep`, and the
	 * cell, which Lynx handed back, has left its list; its elements are the caller's to let go of.
	 */
	rewritten(id: number): "ignore" | "keep" | "release";
	/** The cells of a list that have elements. */
	heldCells(id: number): HeldCell[];
	/** A list's items now, and as Lynx last heard of them. */
	orderOf(id: number): { items: number[]; committed: number[] };
	/** Lets go of a list without touching it, for other lists to take (`adopt`). */
	forget(id: number): ListState | undefined;
	/**
	 * Takes a list that other lists let go of, under this id: its items are `items` now, and each
	 * keeps the element of its cell in `cells`. Lynx calls this module's callbacks from now on.
	 */
	adopt(id: number, adopted: { state: ListState } & AdoptedItems): void;
}

const answerNone: ComponentAtIndex = () => -1;
const doNothing = (): void => {};

/** The lists of one page. */
export function createLists(scope: ListsScope): Lists {
	const lists = new Map<number, ListState>();
	// The info of each item, from its making on: an item's attributes are set before it joins.
	const infos = new Map<number, ListItemInfo>();
	// The list each item of a list inside a cell is in.
	const listOf = new Map<number, number>();
	// The lists inside a cell whose items changed since the last flush.
	const dirty = new Set<ListState>();
	// The cells `ask` named, until they are taken.
	const wanted: number[] = [];

	const kept = (list: ListState): number => Math.max(KEPT_CELLS, list.bound - 2 * list.preload);

	/** A cell of a list whose cells can be let go of, with its list. */
	function releasable(id: number): { list: ListState; cell: Cell } | undefined {
		for (const list of lists.values()) {
			const cell = list.releases ? list.cells.get(id) : undefined;
			if (cell) return { list, cell };
		}
		return undefined;
	}

	function attach(list: ListState, cell: Cell): number {
		if (!cell.element) {
			scope.openCell(cell.id);
			// The lists inside the cell hear of their items before the cell is shown.
			flush();
			const element = scope.elementOf(cell.id);
			if (!element) throw new Error(`The list has no element for its cell ${cell.id}.`);
			cell.element = element;
			cell.uid = mainThread.__GetElementUniqueID(element);
			list.cellsByUid.set(cell.uid, cell);
		}
		if (!cell.attached) {
			mainThread.__AppendElement(list.element, cell.element);
			cell.attached = true;
		}
		if (!cell.bound) {
			cell.bound = true;
			list.bound++;
		}
		list.unbound.delete(cell);
		cell.asked = false;
		return cell.uid;
	}

	function drop(list: ListState, cell: Cell): void {
		if (cell.attached && cell.element) mainThread.__RemoveElement(list.element, cell.element);
		list.cells.delete(cell.id);
		list.cellsByUid.delete(cell.uid);
		list.unbound.delete(cell);
	}

	function cellAt(list: ListState, index: number): Cell | undefined {
		const id = list.committed[index];
		return id === undefined ? undefined : list.cells.get(id);
	}

	/** Gives Lynx the items, and drops the removed cells it does not show. */
	function commit(list: ListState, items: number[], info: ListUpdateInfo): void {
		// Before the update: iOS asks for cells at their new indexes inside it.
		list.committed = items;
		list.changed.clear();
		mainThread.__SetAttribute(list.element, "update-list-info", info);
		// oxlint-disable-next-line unicorn/no-useless-spread -- copied: drop deletes from the map
		for (const cell of [...list.cells.values()]) if (cell.removed && !cell.bound) drop(list, cell);
	}

	function callbacks(id: number): {
		componentAtIndex: ComponentAtIndex;
		componentAtIndexes: ComponentAtIndexes;
		enqueueComponent: EnqueueComponent;
	} {
		return {
			componentAtIndex(_element, listId, index, operationId) {
				try {
					const list = lists.get(id);
					const cell = list && cellAt(list, index);
					if (!list || !cell) return -1;
					const uid = attach(list, cell);
					mainThread.__FlushElementTree(cell.element, {
						triggerLayout: true,
						operationID: operationId,
						elementID: uid,
						listID: listId,
					});
					return uid;
				} catch (error) {
					scope.report(error);
					return -1;
				}
			},
			componentAtIndexes(_element, listId, indexes, operationIds, _reuse, asyncFlush) {
				try {
					const list = lists.get(id);
					if (!list) return;
					const uids = indexes.map((index) => {
						const cell = cellAt(list, index);
						if (!cell) return -1;
						const uid = attach(list, cell);
						if (asyncFlush) mainThread.__FlushElementTree(cell.element, { asyncFlush: true });
						return uid;
					});
					mainThread.__FlushElementTree(list.element, {
						triggerLayout: true,
						operationIDs: operationIds,
						elementIDs: uids,
						listID: listId,
					});
				} catch (error) {
					scope.report(error);
				}
			},
			enqueueComponent(_element, _listId, sign) {
				const list = lists.get(id);
				const cell = list?.cellsByUid.get(sign);
				if (!list || !cell?.bound) return;
				cell.bound = false;
				list.bound--;
				if (cell.removed) {
					drop(list, cell);
					return;
				}
				if (!list.releases) return;
				list.unbound.add(cell);
				if (list.unbound.size > kept(list)) scope.schedule!();
			},
		};
	}

	function flush(): void {
		if (dirty.size === 0) return;
		// Taken first: Lynx may ask for a cell inside an update, and making one flushes the lists in it.
		const changed = [...dirty];
		dirty.clear();
		for (const list of changed) {
			const items = list.items.toArray();
			const info = listUpdateInfo({
				committed: list.committed,
				items,
				infos,
				changed: list.changed,
			});
			commit(list, items, info);
		}
	}

	return {
		create(id) {
			const { componentAtIndex, componentAtIndexes, enqueueComponent } = callbacks(id);
			const element = mainThread.__CreateList(
				scope.pageUid,
				componentAtIndex,
				enqueueComponent,
				{},
				componentAtIndexes,
			);
			lists.set(id, {
				element,
				items: new Order(),
				committed: [],
				cells: new Map(),
				cellsByUid: new Map(),
				changed: new Set(),
				releases: false,
				unbound: new Set(),
				bound: 0,
				preload: 0,
			});
			return element;
		},
		isList: (id) => lists.has(id),
		insert(listId, { id, anchor }) {
			const list = lists.get(listId)!;
			let cell = list.cells.get(id);
			if (cell) {
				cell.removed = false;
				list.items.delete(id);
			} else {
				cell = newCell(id);
				list.cells.set(id, cell);
			}
			list.items.insert(id, anchor);
			listOf.set(id, listId);
			dirty.add(list);
		},
		remove(listId, itemId) {
			const list = lists.get(listId)!;
			list.items.delete(itemId);
			const cell = list.cells.get(itemId);
			if (cell) cell.removed = true;
			listOf.delete(itemId);
			dirty.add(list);
		},
		update(listId, { info, items, added, removed }) {
			const list = lists.get(listId)!;
			list.releases = scope.schedule !== undefined;
			for (const id of added) {
				const cell = list.cells.get(id);
				if (cell) cell.removed = false;
				else list.cells.set(id, newCell(id));
			}
			for (const id of removed) {
				const cell = list.cells.get(id);
				if (cell) cell.removed = true;
			}
			commit(list, items, info);
		},
		setInfo(id, { key, value }) {
			let info = infos.get(id);
			if (!info) infos.set(id, (info = {}));
			if (value == null) delete info[key];
			else info[key] = value;
			const list = lists.get(listOf.get(id) ?? 0);
			if (list) {
				list.changed.add(id);
				dirty.add(list);
			}
		},
		release(id) {
			infos.delete(id);
			const list = lists.get(id);
			if (!list) return;
			// Lynx may still call a list it has not let go of yet.
			mainThread.__UpdateListCallbacks(list.element, answerNone, doNothing, doNothing);
			dirty.delete(list);
			lists.delete(id);
		},
		destroy() {
			for (const list of lists.values())
				mainThread.__UpdateListCallbacks(list.element, null, null, null);
			lists.clear();
			dirty.clear();
			infos.clear();
			listOf.clear();
			wanted.length = 0;
		},
		flush,
		setPreload(id, value) {
			const list = lists.get(id);
			const count = Number(value);
			if (list) list.preload = Number.isFinite(count) && count > 0 ? count : 0;
		},
		takeRewrites() {
			const ids = wanted.splice(0);
			for (const list of lists.values()) {
				let past = list.unbound.size - kept(list);
				for (const cell of list.unbound) {
					if (past-- <= 0) break;
					list.unbound.delete(cell);
					cell.asked = true;
					ids.push(cell.id);
				}
			}
			return ids;
		},
		ask(id) {
			const found = releasable(id);
			if (!found || found.cell.element || found.cell.asked) return;
			found.cell.asked = true;
			wanted.push(id);
			scope.schedule!();
		},
		rewritten(id) {
			const found = releasable(id);
			if (!found?.cell.asked) return "ignore";
			const { list, cell } = found;
			cell.asked = false;
			if (!cell.element) return "keep";
			if (cell.attached) mainThread.__RemoveElement(list.element, cell.element);
			list.cellsByUid.delete(cell.uid);
			list.unbound.delete(cell);
			cell.element = undefined;
			cell.uid = -1;
			cell.attached = false;
			return "release";
		},
		heldCells(id) {
			const held: HeldCell[] = [];
			for (const cell of lists.get(id)?.cells.values() ?? []) {
				if (!cell.element) continue;
				const { element, uid, attached, bound } = cell;
				held.push({ id: cell.id, element, uid, attached, bound });
			}
			return held;
		},
		orderOf(id) {
			const list = lists.get(id);
			return { items: list?.items.toArray() ?? [], committed: list?.committed ?? [] };
		},
		forget(id) {
			const list = lists.get(id);
			if (!list) return undefined;
			lists.delete(id);
			dirty.delete(list);
			return list;
		},
		adopt(id, { state, items, cells, committed = items, infos: itemInfos }) {
			const list: ListState = {
				element: state.element,
				items: new Order(),
				committed,
				cells: new Map(),
				cellsByUid: new Map(),
				changed: new Set(),
				releases: itemInfos === undefined && scope.schedule !== undefined,
				unbound: new Set(),
				bound: 0,
				preload: state.preload,
			};
			for (let index = 0; index < items.length; index++) {
				const itemId = items[index]!;
				list.items.insert(itemId, 0);
				const held = cells[index];
				const cell: Cell = held
					? { ...held, id: itemId, removed: false, asked: false }
					: newCell(itemId);
				list.cells.set(itemId, cell);
				if (held) list.cellsByUid.set(held.uid, cell);
				if (cell.bound) list.bound++;
				else if (held && list.releases) list.unbound.add(cell);
				const info = itemInfos?.get(itemId);
				if (itemInfos) listOf.set(itemId, id);
				if (info) infos.set(itemId, info);
			}
			// Lynx heard of items that are not this list's any more: it is told at the next flush.
			if (committed.join() !== items.join()) dirty.add(list);
			lists.set(id, list);
			const { componentAtIndex, componentAtIndexes, enqueueComponent } = callbacks(id);
			mainThread.__UpdateListCallbacks(
				state.element,
				componentAtIndex,
				enqueueComponent,
				componentAtIndexes,
			);
		},
	};
}
