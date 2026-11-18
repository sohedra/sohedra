// Lynx's callbacks of a page's list: it asks for the cell at an index, or several at once, and hands
// a cell back. A cell the main thread has no text for yet, a deferred row, is answered later
// (./waiting.ts).

import { mainThread } from "../globals.ts";
import type { ComponentAtIndex, ComponentAtIndexes, EnqueueComponent } from "../globals.ts";
import type { Cell, ListState } from "./state.ts";
import { askAhead, waitFor } from "./waiting.ts";
import type { WaitingScope } from "./waiting.ts";

/** What the callbacks need of the page's lists. */
export interface CallbacksScope {
	/** The list with this id, while it is the page's. */
	list(id: number): ListState | undefined;
	/** The cell of a list's item at an index, as Lynx last heard of the items. */
	cellAt(list: ListState, index: number): Cell | undefined;
	/** Gives Lynx the cell: makes it if it has no element, and returns its unique id. */
	attach(list: ListState, cell: Cell): number;
	/** Whether the main thread can make the cell now. */
	written(id: number): boolean;
	waiting: WaitingScope;
	/** Lynx handed the cell back. */
	handedBack(list: ListState, cell: Cell): void;
	report(error: unknown): void;
}

/** The callbacks Lynx calls for each list. */
export interface ListCallbacks {
	componentAtIndex: ComponentAtIndex;
	componentAtIndexes: ComponentAtIndexes;
	enqueueComponent: EnqueueComponent;
}

/** Makes the callbacks of the list with an id, from `scope`. */
export function listCallbacks(scope: CallbacksScope): (id: number) => ListCallbacks {
	return (id) => {
		return {
			componentAtIndex(_element, listId, index, operationId) {
				try {
					const list = scope.list(id);
					const cell = list && scope.cellAt(list, index);
					if (!list || !cell) return -1;
					askAhead(list, { index, cellAt: (at) => scope.cellAt(list, at), scope: scope.waiting });
					if (!cell.element && !scope.written(cell.id)) {
						return waitFor(cell, {
							scope: scope.waiting,
							answer: (uid) =>
								mainThread.__FlushElementTree(cell.element, {
									triggerLayout: true,
									operationID: operationId,
									elementID: uid,
									listID: listId,
								}),
						});
					}
					const uid = scope.attach(list, cell);
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
					const list = scope.list(id);
					if (!list) return;
					const later: Promise<number>[] = [];
					const uids = indexes.map((index, at) => {
						const cell = scope.cellAt(list, index);
						if (!cell) return -1;
						if (!cell.element && !scope.written(cell.id)) {
							later.push(
								waitFor(cell, { scope: scope.waiting, answer: () => {} }).then((uid) => {
									uids[at] = uid;
									return uid;
								}),
							);
							return -1;
						}
						const uid = scope.attach(list, cell);
						if (asyncFlush) mainThread.__FlushElementTree(cell.element, { asyncFlush: true });
						return uid;
					});
					const flush = (): void =>
						mainThread.__FlushElementTree(list.element, {
							triggerLayout: true,
							operationIDs: operationIds,
							elementIDs: uids,
							listID: listId,
						});
					// The cells there are now, then all of them, with the same requests, once the rest come.
					flush();
					if (later.length > 0) void Promise.all(later).then(flush);
				} catch (error) {
					scope.report(error);
				}
			},
			enqueueComponent(_element, _listId, sign) {
				const list = scope.list(id);
				const cell = list?.cellsByUid.get(sign);
				if (!list || !cell?.bound) return;
				cell.bound = false;
				list.bound--;
				scope.handedBack(list, cell);
			},
		};
	};
}
