// The cells of a page's list that Lynx handed back: a list keeps some with their elements, and
// asks the background to write the oldest past those again. When the text comes, a cell Lynx
// still has not taken back leaves the list and its elements are let go of, which frees their views,
// and the text is kept for the next time Lynx asks. A cell never shown whose kept text piled up is
// asked for the same way.
//
// A row let go of keeps what the background holds: its `$state`, effects, handlers, attributes,
// styles set from code, and a controlled input's value. What only its views held goes:
//   - a running animation stops, and its `finished` rejects as canceled;
//   - an uncontrolled input's text, focus, and a scroll offset, such as a carousel's in the row;
//   - `layoutchange` and an image's `load` or `error` fire again when the row is made again;
//   - an element's `uid` names the element that went, until an event comes from the new one.
// A row with `recyclable={false}` is never handed back, so it keeps its views.

import { mainThread } from "../globals.ts";
import type { Cell, ListState } from "./state.ts";

/**
 * The fewest cells Lynx handed back that a list keeps with their elements. Lynx holds a screen of
 * cells and `preload-buffer-count` more on each side (9, 19 and 49 cells at 0, 5 and 20 on an iOS
 * device, with rows a ninth of the screen tall), so what it holds less twice that count is a
 * screen of this list's rows. A list keeps that many, and at least this: a screen of such rows,
 * rounded up. A list of tall rows, a few to a screen, so keeps several screens of them.
 */
const KEPT_CELLS = 10;

/** How the background wrote a cell again turns out (see `LetGo.rewritten`). */
export type Rewritten = "ignore" | "keep" | "let-go";

/** Letting go of the cells of a page's lists. */
interface LetGo {
	/** Lynx handed back a cell that keeps its element; past what the list keeps, it is asked for. */
	handedBack(list: ListState, cell: Cell): void;
	/**
	 * The cells to ask the background to write again, `max` at most: those `ask` named that Lynx
	 * has not asked for since, then the oldest Lynx handed back past what each list keeps. They are
	 * marked asked; the others wait for the next call.
	 */
	takeRewrites(max: number): number[];
	/** A cell Lynx never showed is to be written again, at the next `takeRewrites`. */
	ask(id: number): void;
	/**
	 * The background wrote a cell again. `ignore`: not asked for, or Lynx asked for it since, and it
	 * keeps what it has. `keep`: its new text replaces what was kept. `let-go`: as `keep`, and the
	 * cell, which Lynx handed back, has left its list; its elements are the caller's to let go of.
	 */
	rewritten(id: number): Rewritten;
	/** The page is gone: nothing is asked for. */
	clear(): void;
}

/** Letting go of the cells of `lists`; `schedule` asks for `takeRewrites` on a later task. */
export function createLetGo(lists: ReadonlyMap<number, ListState>, schedule: () => void): LetGo {
	// The cells `ask` named, until they are taken.
	const wanted: Cell[] = [];

	const kept = (list: ListState): number => Math.max(KEPT_CELLS, list.bound - 2 * list.preload);

	/** A cell of a list whose cells can be let go of, with its list. */
	function cellToLetGo(id: number): { list: ListState; cell: Cell } | undefined {
		for (const list of lists.values()) {
			const cell = list.letsGo ? list.cells.get(id) : undefined;
			if (cell) return { list, cell };
		}
		return undefined;
	}

	return {
		handedBack(list, cell) {
			list.unbound.add(cell);
			if (list.unbound.size > kept(list)) schedule();
		},
		takeRewrites(max) {
			const ids: number[] = [];
			let taken = 0;
			for (; taken < wanted.length && ids.length < max; taken++) {
				const cell = wanted[taken]!;
				// Lynx asked for it since, and it has its elements.
				if (cell.asked && !cell.element) ids.push(cell.id);
			}
			wanted.splice(0, taken);
			for (const list of lists.values()) {
				let past = list.unbound.size - kept(list);
				for (const cell of list.unbound) {
					if (past-- <= 0 || ids.length >= max) break;
					list.unbound.delete(cell);
					cell.asked = true;
					ids.push(cell.id);
				}
			}
			return ids;
		},
		ask(id) {
			const found = cellToLetGo(id);
			if (!found || found.cell.element || found.cell.asked) return;
			found.cell.asked = true;
			wanted.push(found.cell);
			schedule();
		},
		rewritten(id) {
			const found = cellToLetGo(id);
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
			return "let-go";
		},
		clear() {
			wanted.length = 0;
		},
	};
}
