// Deferred list rows: a `<list-item defer>` renders its contents only once Lynx first asks for the
// row. The build gives the row's contents an `{#if}` on the row's state (`deferredRow`) and links
// the state to the element (`DEFERRED_ROW`). On a list of the page, a row whose contents have not
// rendered sends no text: the main thread asks for it when Lynx does (a show message), and the
// background renders the contents and writes the whole row. Anywhere else, a row renders at once.

import { signal, sourceLocation } from "../../svelte/runtime/index.ts";
import type { Signal } from "../../svelte/runtime/index.ts";
import { ASYNC_LIST } from "../../wire/index.ts";
import { backgroundError } from "../catalogue.ts";
import { reportError } from "../report.ts";
import type { TreeNode } from "./node.ts";
import { realContainer } from "./tree.ts";

/** What `defer` takes besides `true`. */
export interface DeferOptions {
	/**
	 * When Lynx hands the row back and the main thread lets go of it, its contents are unmounted
	 * too, and their state with them; shown again, the row renders afresh.
	 */
	unmountRecycled?: boolean;
}

/** The state of one deferred row, which its `{#if}` reads. Plain fields: see `TreeNode`. */
export class DeferredRow {
	/** The value of `defer`, read where it is written. */
	readonly option: () => unknown;
	/** Whether its contents are asked for: Lynx asked for the row, or it renders where it is. */
	private readonly opened: Signal<boolean> = signal(false);
	private open: boolean = false;
	/** `defer` was false while the row rendered: it renders from then on, as if never deferred. */
	private always: boolean = false;

	constructor(option: () => unknown) {
		this.option = option;
	}

	/** Whether the contents render, read by the row's `{#if}`. */
	get ready(): boolean {
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

/** The state of a deferred row, for its `{#if}`: the build calls this in the row's markup. */
export function deferredRow(option: () => unknown): DeferredRow {
	return new DeferredRow(option);
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
 * is Lynx's async list. On another list, the row is reported, once per list, and renders now.
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
