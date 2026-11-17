// What a Lynx `<list>` is told when its items change: its `update-list-info`. The background writes
// it for the lists of the page, the main thread for the lists inside a cell and the first frame's.
//
// Plain loops and property copies: object spread is a helper call per object once compiled for
// Lynx's JavaScript engine, and a list can have thousands of items.

/** What a list item tells the list about itself: the values of its `LIST_ITEM_INFO` attributes. */
export type ListItemInfo = Record<string, unknown>;

/** The `<list-item>` attributes the list itself reads, which travel in its update. */
export const LIST_ITEM_INFO: ReadonlySet<string> = new Set([
	"item-key",
	"reuse-identifier",
	"full-span",
	"sticky-top",
	"sticky-bottom",
	"estimated-height",
	"estimated-height-px",
	"estimated-main-axis-size-px",
	"recyclable",
]);

/** An item that joins the list at `position`, with its info. */
export interface ListInsertion extends ListItemInfo {
	position: number;
	type: string;
}

/** An item that keeps its place and whose info changed. */
export interface ListUpdate extends ListItemInfo {
	from: number;
	to: number;
	flush: false;
	type: string;
}

/** A list's `update-list-info`: removals at old indexes, insertions and updates at new positions. */
export interface ListUpdateInfo {
	insertAction: ListInsertion[];
	removeAction: number[];
	updateAction: ListUpdate[];
}

/** What a list update is written from. */
export interface ListChange {
	/** The item ids as the list last heard of them. */
	committed: number[];
	/** The item ids now. */
	items: number[];
	/** Each item's info. */
	infos: ReadonlyMap<number, ListItemInfo>;
	/** The items whose info changed since the list last heard of them. */
	changed: ReadonlySet<number>;
}

/** An item's type, by which the list reuses cells: its `reuse-identifier`, or `list-item`. */
function typeOf(info: ListItemInfo | undefined): string {
	const type = info?.["reuse-identifier"];
	return typeof type === "string" || typeof type === "number" ? String(type) : "list-item";
}

function insertion(position: number, info: ListItemInfo | undefined): ListInsertion {
	const entry: ListInsertion = { position, type: typeOf(info) };
	if (info) for (const key in info) entry[key] = info[key];
	return entry;
}

function update(position: number, info: ListItemInfo | undefined): ListUpdate {
	const entry: ListUpdate = { from: position, to: position, flush: false, type: "" };
	if (info) for (const key in info) entry[key] = info[key];
	// After the info's own keys, which may not replace these.
	entry.from = position;
	entry.to = position;
	entry.flush = false;
	entry.type = typeOf(info);
	return entry;
}

/**
 * What changed from `committed` to `items`. The items that keep their order stay; every other old
 * item is removed and every other new item inserted, so a move is a removal and an insertion.
 */
export function listUpdateInfo({ committed, items, infos, changed }: ListChange): ListUpdateInfo {
	const insertAction: ListInsertion[] = [];
	const removeAction: number[] = [];
	const updateAction: ListUpdate[] = [];
	if (committed.length === 0) {
		for (let position = 0; position < items.length; position++)
			insertAction.push(insertion(position, infos.get(items[position]!)));
		return { insertAction, removeAction, updateAction };
	}
	const kept = unmoved(committed, items);
	for (let index = 0; index < committed.length; index++)
		if (!kept.has(committed[index]!)) removeAction.push(index);
	for (let position = 0; position < items.length; position++) {
		const id = items[position]!;
		if (!kept.has(id)) insertAction.push(insertion(position, infos.get(id)));
		else if (changed.has(id)) updateAction.push(update(position, infos.get(id)));
	}
	return { insertAction, removeAction, updateAction };
}

/**
 * The items that keep their place from `before` to `after`: those in both, in the longest run
 * whose relative order is unchanged.
 */
export function unmoved(before: number[], after: number[]): Set<number> {
	const oldIndex = new Map<number, number>();
	for (let index = 0; index < before.length; index++) oldIndex.set(before[index]!, index);
	const ids: number[] = [];
	const order: number[] = [];
	for (const id of after) {
		const index = oldIndex.get(id);
		if (index !== undefined) {
			ids.push(id);
			order.push(index);
		}
	}
	// The longest increasing run of `order`, by patience sorting.
	const tails: number[] = [];
	// oxlint-disable-next-line unicorn/no-new-array -- allocated once at its length: a list can have thousands of items
	const previous = new Array<number>(order.length).fill(-1);
	for (let i = 0; i < order.length; i++) {
		let lo = 0;
		let hi = tails.length;
		while (lo < hi) {
			const mid = (lo + hi) >> 1;
			if (order[tails[mid]!]! < order[i]!) lo = mid + 1;
			else hi = mid;
		}
		if (lo > 0) previous[i] = tails[lo - 1]!;
		tails[lo] = i;
	}
	const kept = new Set<number>();
	for (let i = tails.length > 0 ? tails[tails.length - 1]! : -1; i !== -1; i = previous[i]!)
		kept.add(ids[i]!);
	return kept;
}

/**
 * Ids in order, as a linked list keyed by id: a list's items, as elements are inserted and removed
 * one at a time. Ids are positive; 0 is none.
 */
export class Order {
	private first = 0;
	private last = 0;
	private prev = new Map<number, number>();
	private next = new Map<number, number>();

	/** Inserts `id` before `anchor`; an anchor of 0, or one not in the order, appends. */
	insert(id: number, anchor: number): void {
		const before = anchor !== 0 && this.next.has(anchor) ? anchor : 0;
		const prev = before === 0 ? this.last : this.prev.get(before)!;
		this.prev.set(id, prev);
		this.next.set(id, before);
		if (prev === 0) this.first = id;
		else this.next.set(prev, id);
		if (before === 0) this.last = id;
		else this.prev.set(before, id);
	}

	/** Removes `id`, if the order holds it. */
	delete(id: number): void {
		if (!this.next.has(id)) return;
		const prev = this.prev.get(id)!;
		const next = this.next.get(id)!;
		if (prev === 0) this.first = next;
		else this.next.set(prev, next);
		if (next === 0) this.last = prev;
		else this.prev.set(next, prev);
		this.prev.delete(id);
		this.next.delete(id);
	}

	/** The ids, first to last. */
	toArray(): number[] {
		const out: number[] = [];
		for (let id = this.first; id !== 0; id = this.next.get(id)!) out.push(id);
		return out;
	}
}
