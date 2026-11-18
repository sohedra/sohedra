// A list handed from one page's lists to another's at hydration: the first frame's lists let go
// of a list, and the page's take it under the background's ids, with the cells Lynx holds.

import type { ListItemInfo } from "../../wire/index.ts";
import type { LynxElement } from "../globals.ts";
import { newCell, newList } from "./state.ts";
import type { Cell, ListState } from "./state.ts";

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

/** The cells of a list that have elements. */
export function heldCells(list: ListState | undefined): HeldCell[] {
	const held: HeldCell[] = [];
	for (const cell of list?.cells.values() ?? []) {
		if (!cell.element) continue;
		const { element, uid, attached, bound } = cell;
		held.push({ id: cell.id, element, uid, attached, bound });
	}
	return held;
}

/**
 * The list `state` as another page's lists take it: its items are `items` now, and each keeps the
 * element of its cell in `cells`.
 */
export function adoptedList(
	{ state, items, cells, committed = items }: { state: ListState } & AdoptedItems,
	releases: boolean,
): ListState {
	const list = newList({ element: state.element, committed, releases, preload: state.preload });
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
	}
	return list;
}
