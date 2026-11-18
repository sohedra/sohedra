// The cells of a page's list that Lynx handed back: a list keeps some with their elements, and
// asks the background to write the oldest past those again. When the text comes, a cell Lynx
// still has not taken back leaves the list and its elements are let go of, which frees their views,
// and the text is kept for the next time Lynx asks. A cell never shown whose kept text piled up is
// asked for the same way.

import { mainThread } from "../globals.ts";
import type { Cell, ListState } from "./state.ts";

/**
 * The fewest cells Lynx handed back that a list keeps with their elements. Lynx holds a screen of
 * cells and `preload-buffer-count` more on each side (9, 19 and 49 cells at 0, 5 and 20 on an iOS
 * device, with rows of 15 elements), so what it holds less twice that count is a screen of this
 * list's rows; a list keeps that many, and at least this: such a screen, rounded up.
 */
const KEPT_CELLS = 10;

/** How the background wrote a cell again turns out (see `Release.rewritten`). */
export type Rewritten = "ignore" | "keep" | "release";

/** The release of the cells of a page's lists. */
export interface Release {
	/** Lynx handed back a cell that keeps its element; past what the list keeps, it is asked for. */
	handedBack(list: ListState, cell: Cell): void;
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
	rewritten(id: number): Rewritten;
	/** The page is gone: nothing is asked for. */
	clear(): void;
}

/** The release of the cells of `lists`; `schedule` asks for `takeRewrites` on a later task. */
export function createRelease(
	lists: ReadonlyMap<number, ListState>,
	schedule: () => void,
): Release {
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

	return {
		handedBack(list, cell) {
			list.unbound.add(cell);
			if (list.unbound.size > kept(list)) schedule();
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
			schedule();
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
		clear() {
			wanted.length = 0;
		},
	};
}
