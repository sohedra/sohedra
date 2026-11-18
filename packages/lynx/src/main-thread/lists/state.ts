// What a page's list keeps of itself and of its cells: the state the list's modules share.

import { Order } from "../../wire/index.ts";
import type { LynxElement } from "../globals.ts";

/** One cell of a list: one of its items, and the element Lynx shows it with, once made. */
export interface Cell {
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
	/**
	 * Lynx asked for it before the main thread had its text (a deferred row): each answers Lynx
	 * when the cell is made, with its unique id, or -1 when it never will be.
	 */
	waiting: ((uid: number) => void)[] | null;
	/** The background was asked to render it, and has not written it yet. */
	requested: boolean;
	/** Its text was let go of with its contents: until it is written whole, its ops are dropped. */
	hidden: boolean;
}

/** A cell with no element yet. */
export const newCell = (id: number): Cell => ({
	id,
	element: undefined,
	uid: -1,
	attached: false,
	bound: false,
	removed: false,
	asked: false,
	waiting: null,
	requested: false,
	hidden: false,
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
	/** The index Lynx asked for last, -1 before any. */
	lastAsked: number;
	/** Which way Lynx asks: 1 down the list, -1 up. */
	direction: 1 | -1;
}

/** A list with no items yet. */
export function newList(options: {
	element: LynxElement;
	committed?: number[];
	releases?: boolean;
	preload?: number;
}): ListState {
	return {
		element: options.element,
		items: new Order(),
		committed: options.committed ?? [],
		cells: new Map(),
		cellsByUid: new Map(),
		changed: new Set(),
		releases: options.releases ?? false,
		unbound: new Set(),
		bound: 0,
		preload: options.preload ?? 0,
		lastAsked: -1,
		direction: 1,
	};
}
