// Deferred list rows: a `<list-item defer>` renders its contents only once Lynx first asks for the
// row, or as the page starts when the row is among its list's initial rows. The build gives the row's
// contents an `{#if}` on the row's state (`deferredRow`) and links the state to the element
// (`DEFERRED_ROW`). On a list of the page, a row whose contents have not rendered sends no text: the
// main thread asks for it when Lynx does (a show message), and the background renders the contents
// and writes the whole row. Anywhere else, a row renders in the next patch.

import { signal, sourceLocation, startingInitialRows } from "../../svelte/runtime/index.ts";
import type { Signal } from "../../svelte/runtime/index.ts";
import { ASYNC_LIST } from "../../wire/index.ts";
import { backgroundError } from "../catalogue.ts";
import { reportError } from "../report.ts";
import type { TreeNode } from "./node.ts";
import { realContainer } from "./tree.ts";

/** What `defer` takes besides `true`. */
export interface DeferOptions {
	/**
	 * When the main thread lets go of the row Lynx handed back, its contents are unmounted too, and
	 * their state with them; shown again, the row renders afresh. Lynx handing the row back is not
	 * enough: the main thread keeps the last rows handed back, about a screen of them, and lets go
	 * of a row only past those, so a short scroll away and back keeps its state.
	 */
	unmountRecycled?: boolean;
}

/** Where a deferred row is, as the build reads it from the row's markup. */
export interface RowPlace {
	/** The value of the row's `full-span`: it takes a whole line of its list's initial rows. */
	fullSpan?: () => unknown;
	/** In a branch only one thread renders: it never takes a place among a list's initial rows. */
	oneThread?: boolean;
}

/** The state of one deferred row, which its `{#if}` reads. Plain fields: see `TreeNode`. */
export class DeferredRow {
	/** The value of `defer`, read where it is written. */
	readonly option: () => unknown;
	private readonly place: RowPlace;
	/**
	 * Whether its contents are asked for: Lynx asked for the row, it renders where it is, or it is
	 * among its list's initial rows. Made with the row, not as its `{#if}` first reads it: an effect does
	 * not subscribe to a signal it made itself.
	 */
	private readonly opened: Signal<boolean> = signal(false);
	private open: boolean = false;
	/** Whether the row rendered yet: it takes its place among its list's initial rows then. */
	private placed: boolean = false;
	/** `defer` was false while the row rendered: it renders from then on, as if never deferred. */
	private always: boolean = false;

	constructor(option: () => unknown, place: RowPlace = {}) {
		this.option = option;
		this.place = place;
	}

	/** Whether the contents render, read by the row's `{#if}`. */
	get ready(): boolean {
		if (!this.placed) {
			this.placed = true;
			// As the page starts, the row takes its place among its list's initial rows, in the order the
			// first frame counted it.
			const initial = this.place.oneThread ? undefined : startingInitialRows();
			if (initial?.row(this.place.fullSpan?.()) === true) this.show();
		}
		if (this.opened.read() || this.always) return true;
		if (!this.option()) this.always = true;
		return this.always;
	}

	/** Whether its contents are rendered, or render at Svelte's next flush. */
	get shown(): boolean {
		return this.open || this.always;
	}

	/** Its contents render, at Svelte's next flush. */
	show(): void {
		if (this.open) return;
		this.open = true;
		this.opened.write(true);
	}

	/** Its contents unmount, at Svelte's next flush, unless `defer` was ever false. */
	hide(): void {
		if (!this.open) return;
		this.open = false;
		this.opened.write(false);
	}

	/** Whether its contents go when the main thread lets go of the row (`unmountRecycled`). */
	get unmountsRecycled(): boolean {
		const option = this.option();
		return (
			typeof option === "object" &&
			option !== null &&
			Reflect.get(option, "unmountRecycled") === true
		);
	}
}

/**
 * The state of a deferred row, for its `{#if}`: the build calls this in the row's markup, with the
 * value of its `defer` and where it is.
 */
export function deferredRow(option: () => unknown, place?: RowPlace): DeferredRow {
	return new DeferredRow(option, place);
}

const rows = new WeakMap<TreeNode, DeferredRow>();
/** The lists whose rows were deferred on a list that is not Lynx's async list, reported once each. */
const reported = new WeakSet<TreeNode>();

/** Links `element` to its row's state, the value the build gives `DEFERRED_ROW`. */
export function linkRow(element: TreeNode, value: unknown): void {
	if (value instanceof DeferredRow) rows.set(element, value);
	else rows.delete(element);
}

/** The state of the deferred row `element` is, if it is one. */
export function rowOf(element: TreeNode | undefined): DeferredRow | undefined {
	return element && rows.get(element);
}

/**
 * Whether the main thread waits for the row `element`, a cell of a list of the page, to be asked
 * for before it gets the row's text: it is deferred, its contents have not rendered, and its list
 * is Lynx's async list. On another list, the row is reported, once per list, and renders in the
 * next patch.
 */
export function waitsToBeAsked(element: TreeNode): boolean {
	const row = rows.get(element);
	if (!row || row.shown) return false;
	const list = realContainer(element.parent);
	if (list?.attrs?.get("custom-list-name") === ASYNC_LIST) return true;
	if (list && !reported.has(list)) {
		reported.add(list);
		reportError(
			backgroundError({
				code: "list_item_defer_needs_async_list",
				details: { where: sourceLocation(element) },
			}),
		);
	}
	row.show();
	return false;
}
