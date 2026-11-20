// The cells the main thread has no text for: a `<list-item defer>` whose contents the background
// has not rendered, or whose text was let go of with them. When Lynx asks for one, the list answers
// with a promise, as Lynx's async list allows, and asks the background to render it; the cell is
// made and flushed with Lynx's request when its text comes. The background also renders the rows a
// few places ahead, in the way Lynx is asking, so a fling finds them written.

import type { Cell, ListState } from "./state.ts";

/**
 * How many rows past the one Lynx asked for are asked of the background, in the way Lynx is
 * asking. A device took a cell flushed about 70 ms after Lynx asked for it. Android's fastest
 * fling (`ViewConfiguration`'s 8,000 dp a second) passes about six rows a ninth of the screen tall
 * in that time; ten, a screen of such rows, leaves a margin.
 */
export const ROWS_AHEAD = 10;

/** What a page's lists, and its applier, do with the cells the main thread has no text for. */
export interface WaitingCells {
	/**
	 * The background wrote a deferred row's first text, which the caller keeps: a cell Lynx waits
	 * for is made now, and handed to Lynx.
	 */
	firstText(id: number): void;
	/** Whether a cell's text was let go of with its contents, until it is written whole again. */
	isHidden(id: number): boolean;
	/** A cell's text was let go of with its contents: it is a deferred row not written again. */
	hideCell(id: number): void;
	/**
	 * After hydration: the cells Lynx waits for are made if they can be, and asked for if not, and
	 * so are the rows ahead of the last one Lynx asked for.
	 */
	resumeWaiting(): void;
	/** The cells of a list that Lynx waits for, with what answers it. */
	waitingCells(id: number): { id: number; waiting: (uid: number) => void }[];
}

/** What the waiting cells need of the page. */
export interface WaitingScope {
	/** Whether the main thread has the cell's text, or another way to make it. */
	written(id: number): boolean;
	/** Asks the background to render the cell and write it. Without it, nothing is asked. */
	request?: (id: number) => void;
}

/** Asks the background for a cell, once until it is written. */
export function request(cell: Cell, scope: WaitingScope): void {
	if (cell.requested || !scope.request) return;
	cell.requested = true;
	scope.request(cell.id);
}

/**
 * Lynx asked for a cell the main thread has no text for: the promise of its unique id. `answer`
 * runs with the id when the cell is made, before the promise resolves; never with -1.
 *
 * Only Lynx's newest request for a cell is answered: an older one resolves with -1, unflushed.
 * Lynx asks again for a row it binds again (every row, at each update of the list), binds only the
 * newest request, and hands back a cell flushed for an older one while it shows it
 * (core/renderer/ui_component/list/default_list_adapter.cc, BindItemHolder and
 * OnFinishBindItemHolder).
 */
export function waitFor(
	cell: Cell,
	{ scope, answer }: { scope: WaitingScope; answer: (uid: number) => void },
): Promise<number> {
	request(cell, scope);
	cell.waiting?.(-1);
	return new Promise((resolve) => {
		cell.waiting = (uid) => {
			if (uid !== -1) answer(uid);
			resolve(uid);
		};
	});
}

/** The cell is made (its unique id), or never will be (-1): every request for it is answered. */
export function answerWaiting(cell: Cell, uid: number): void {
	const waiting = cell.waiting;
	if (!waiting) return;
	cell.waiting = null;
	waiting(uid);
}

/**
 * Lynx asked for the cell at `index`: the rows ahead of it that have no text are asked of the
 * background. Ahead is down the list while Lynx asks for higher indexes, up while lower. Before
 * hydration, with no background to ask, the request is only noted, for `askAheadOfLast`.
 */
export function askAhead(
	list: ListState,
	{
		index,
		cellAt,
		scope,
	}: {
		index: number;
		cellAt: (index: number) => Cell | undefined;
		scope: WaitingScope;
	},
): void {
	const step = index > list.lastAsked ? 1 : index < list.lastAsked ? -1 : list.direction;
	list.direction = step;
	list.lastAsked = index;
	askAheadOfLast(list, { cellAt, scope });
}

/**
 * The rows ahead of the one Lynx asked for last, in the way it was asking, that have no text are
 * asked of the background. At hydration, the rows Lynx asked for before were answered from the
 * first frame, and none waits: their rows ahead are asked for here, or a fling would find the
 * list ending after its initial rows.
 */
export function askAheadOfLast(
	list: ListState,
	{ cellAt, scope }: { cellAt: (index: number) => Cell | undefined; scope: WaitingScope },
): void {
	if (!scope.request || list.lastAsked < 0) return;
	for (let offset = 1; offset <= ROWS_AHEAD; offset++) {
		const cell = cellAt(list.lastAsked + list.direction * offset);
		if (cell && !cell.element && !scope.written(cell.id)) request(cell, scope);
	}
}
