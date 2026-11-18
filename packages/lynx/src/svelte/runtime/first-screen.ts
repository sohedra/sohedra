// A list's first screen: the rows a page renders whole as it starts, deferred or not, so that the
// first frame shows them and the background renders the same ones before its first patch.
//
// Lynx has no initial count: it asks a list for rows until its layout fills the screen, then for
// `preload-buffer-count` more (`list_container_impl.cc`, `linear_layout_manager.cc`). So a list
// draws (10 + `preload-buffer-count`) × `span-count` rows, 10 being about a phone screen of rows,
// unless `initial-item-count` says how many; a `full-span` row counts as a whole line of them. With
// `initial-scroll-index`, the rows up to that index are drawn too, up to `SCROLL_INDEX_CAP`.
//
// Both threads count the same rows in the same order: the compile step makes each list open its
// count before its rows and close it after them, and each row it counts ask for its place as it
// renders. The main thread's server render writes in that order, and the background's blocks run
// their tests and draw their first branches in it as the page mounts (as `$props.id()` relies on).
// A row only one thread renders, in a branch of `{#if background}`, counts on neither.

import { untrack } from "svelte";

import { inThreadBranch } from "./thread-branches.ts";

/** About a phone screen of rows, before Lynx's `preload-buffer-count`. */
export const SCREEN_ROWS = 10;

/**
 * The furthest `initial-scroll-index` the first frame draws up to. Each row drawn whole costs the
 * background about 1.3 ms more than a deferred one as the page starts, on a mid-range Android
 * phone: 100 rows above the screen delay the page's first answer to a tap by about 130 ms.
 */
export const SCROLL_INDEX_CAP = 100;

/**
 * What a `<list>`'s first screen reads of its attributes. Each counts only as a number, as Lynx
 * reads it: `span-count={2}`, not `span-count="2"`.
 */
export interface ListAttributes {
	/** Lynx's rows to a line; `column-count` is its older name. One by default. */
	"span-count"?: unknown;
	"column-count"?: unknown;
	/** The rows Lynx asks for past the screen; none by default. */
	"preload-buffer-count"?: unknown;
	/**
	 * How many rows the first frame draws whole, in place of (10 + `preload-buffer-count`) ×
	 * `span-count`; 0 draws none. Lynx itself has no such attribute: it asks for rows until its
	 * layout fills the screen, then for `preload-buffer-count` more.
	 */
	"initial-item-count"?: unknown;
	/** The row Lynx starts the list at: the rows up to it are drawn too, to `SCROLL_INDEX_CAP`. */
	"initial-scroll-index"?: unknown;
}

/** An `initial-scroll-index` past the cap: the first frame draws the first screen only. */
export interface CutScrollIndex {
	index: number;
	/** The list's `file:line:col`, in development builds. */
	where: string | undefined;
}

interface ListScreen {
	/** Rows before it are drawn whatever the count: those up to `initial-scroll-index`. */
	start: number;
	/** How many rows are drawn from `start`, a `full-span` row counting as `span` of them. */
	count: number;
	span: number;
	/** The rows counted so far, and their share of `count` from `start`. */
	rows: number;
	used: number;
}

/** A whole number Lynx reads from `value`, or `undefined` when Lynx ignores it (a string). */
const numberOf = (value: unknown): number | undefined =>
	typeof value === "number" && Number.isFinite(value) ? Math.trunc(value) : undefined;

/** The first screens of the lists one render draws, innermost last. */
export class FirstScreens {
	private readonly lists: ListScreen[] = [];
	/** The lists whose `initial-scroll-index` the cap left out. */
	readonly cut: CutScrollIndex[] = [];

	/** A list starts: its rows count from here. */
	open(attributes: ListAttributes, where?: string): void {
		const span = Math.max(1, numberOf(attributes["span-count"] ?? attributes["column-count"]) ?? 1);
		const preload = Math.max(0, numberOf(attributes["preload-buffer-count"]) ?? 0);
		const written = numberOf(attributes["initial-item-count"]);
		const count = written === undefined ? (SCREEN_ROWS + preload) * span : Math.max(0, written);
		let start = Math.max(0, numberOf(attributes["initial-scroll-index"]) ?? 0);
		if (start > SCROLL_INDEX_CAP) {
			this.cut.push({ index: start, where });
			start = 0;
		}
		this.lists.push({ start, count, span, rows: 0, used: 0 });
	}

	/** The list that started last ends. */
	close(): void {
		this.lists.pop();
	}

	/** Counts a row of the list being drawn: whether it is drawn whole. */
	row(fullSpan: unknown): boolean {
		const list = this.lists[this.lists.length - 1];
		if (list === undefined || inThreadBranch()) return false;
		if (list.rows++ < list.start) return true;
		const drawn = list.used < list.count;
		list.used += fullSpan === true ? list.span : 1;
		return drawn;
	}
}

/** The attributes a list's count reads, read once and without subscribing to them. */
export const listAttributes = (read: (() => ListAttributes) | undefined): ListAttributes =>
	read === undefined ? {} : untrack(read);

/** The background's count while the page starts, and none after. */
let starting: FirstScreens | undefined;

/** The page starts on the background: its lists count their first screens until it has mounted. */
export function startFirstScreens(): void {
	starting = new FirstScreens();
}

/** The page has mounted: what follows waits as before. Returns the scroll indexes the cap left out. */
export function endFirstScreens(): CutScrollIndex[] {
	const cut = starting?.cut ?? [];
	starting = undefined;
	return cut;
}

/** The background's count of the page that is starting, if one is. */
export const startingScreens = (): FirstScreens | undefined => starting;
