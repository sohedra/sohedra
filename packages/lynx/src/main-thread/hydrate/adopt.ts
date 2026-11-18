// Hydration's changes, once the match has decided them (./match.ts): the page's applier takes the
// drawn elements under the background's ids, with what differs written over them, and makes in
// place the runs that differ more. A list keeps the cells Lynx holds; a cell it handed back is let
// go of, and is made from the background's text when Lynx asks for it again. Then the events the
// first frame heard are replayed through the background's handlers.

import { LIST_ITEM_INFO, OpCode, ROOT_ID } from "../../wire/index.ts";
import type { CallItem, ListItemInfo, Op } from "../../wire/index.ts";
import type { AdoptedList, Applier } from "../apply.ts";
import type { Frame } from "../frame/draw.ts";
import { mainThread } from "../globals.ts";
import type { HeldCell } from "../lists.ts";
import type { Plan } from "./match.ts";
import { opsOf } from "./rendered.ts";
import type { Rendered } from "./rendered.ts";

/** What the page keeps after hydration: the cells' texts it waits with, and the calls to run. */
export interface Hydrated {
	cells: Map<number, string[]>;
	calls: CallItem[];
	/** The background's id of each drawn node the page kept. */
	ids: Map<number, number>;
}

/**
 * Applies `ops` until one fails, and throws its error: hydration cannot finish, and what was not
 * applied stays as it was, for the page written again to replace.
 */
function applyAll(applier: Applier, ops: Op[]): void {
	for (const op of ops) {
		const [failed] = applier.apply([op]);
		if (failed) throw failed.error;
	}
}

/** Carries out `plan`: `applier` is the page's, and the frame's applier lets go of what it takes. */
export function adoptFrame(options: {
	frame: Frame;
	applier: Applier;
	rendered: Rendered;
	plan: Plan;
}): Hydrated {
	const { frame, applier, rendered, plan } = options;
	const drawnApplier = frame.applier;
	const ids = new Map<number, number>();

	// The cells of each adopted list: those Lynx holds keep their elements, the others are let go of.
	const lists = new Map<number, AdoptedList>();
	for (const list of plan.lists) {
		const held = new Map<number, HeldCell>(
			drawnApplier.heldCells(list.drawn).map((cell) => [cell.id, cell]),
		);
		const listElement = drawnApplier.element(list.drawn)!;
		const kept = new Set(list.cells);
		for (const cell of held.values()) {
			if (kept.has(cell.id)) continue;
			if (cell.attached) mainThread.__RemoveElement(listElement, cell.element);
			applyAll(drawnApplier, frame.releaseOps(cell.id));
		}
		lists.set(list.drawn, {
			items: list.items,
			cells: list.cells.map((cell) => (cell === undefined ? undefined : held.get(cell))),
		});
	}

	// What differs more than its attributes leaves the frame, and so do texts it has otherwise.
	for (const repair of [...plan.repairs, ...plan.textRepairs]) {
		const ops: Op[] = [];
		for (const id of repair.drop) {
			ops.push([OpCode.Remove, repair.drawnParent, id]);
			frame.releaseOps(id, ops);
		}
		applyAll(drawnApplier, ops);
	}

	// A list inside a cell: its items are its children, which the match adopted, and Lynx heard of
	// them under the first frame's ids.
	const byDrawn = new Map(plan.adopt.map(([id, drawn]) => [drawn, id]));
	for (const list of plan.nestedLists) {
		const held = new Map<number, HeldCell>(
			drawnApplier.heldCells(list.drawn).map((cell) => [cell.id, cell]),
		);
		const order = drawnApplier.listOrder(list.drawn);
		const kept = order.items.filter((item) => byDrawn.has(item));
		const items = kept.map((item) => byDrawn.get(item)!);
		const infos = new Map<number, ListItemInfo>();
		for (const item of items) {
			const info: ListItemInfo = {};
			for (const [name, value] of rendered.nodes.get(item)!.attrs)
				if (LIST_ITEM_INFO.has(name)) info[name] = value;
			infos.set(item, info);
		}
		lists.set(list.drawn, {
			items,
			cells: kept.map((item) => held.get(item)),
			// An item made again in place is a new one to Lynx: the old one is told gone.
			committed: order.committed.map((item) => byDrawn.get(item) ?? -item),
			infos,
		});
	}

	for (const [id, drawn] of plan.adopt) {
		ids.set(drawn, id);
		const list = lists.get(drawn);
		applier.adopt(id, drawnApplier.forget(drawn), {
			onPage: rendered.nodes.get(id)?.parent === ROOT_ID,
			...(list && { list }),
		});
	}

	// The events, styles and changes of what the page kept, then what it makes again.
	const ops: Op[] = [...rendered.nodes.get(ROOT_ID)!.ops];
	for (const [id] of plan.adopt) for (const op of rendered.nodes.get(id)!.ops) ops.push(op);
	for (const { id, name, value } of plan.writes) {
		if (name === null) ops.push([OpCode.SetText, id, typeof value === "string" ? value : ""]);
		else ops.push([OpCode.SetAttr, id, name, value]);
	}
	// What is made again goes before the node that follows it, text or element: from each parent's
	// last child back, so that node is on the page already, adopted or made.
	const made = new Map<number, Set<number>>();
	for (const repair of [...plan.repairs, ...plan.textRepairs]) {
		let ids = made.get(repair.parent);
		if (!ids) made.set(repair.parent, (ids = new Set()));
		for (const id of repair.make) ids.add(id);
	}
	for (const [parent, ids] of made) {
		const children = rendered.nodes.get(parent)!.children;
		for (let index = children.length - 1; index >= 0; index--) {
			const id = children[index]!;
			if (!ids.has(id)) continue;
			opsOf(rendered, id, ops);
			ops.push([OpCode.Insert, parent, id, children[index + 1] ?? 0]);
		}
	}
	applyAll(applier, ops);

	const cells = new Map<number, string[]>();
	for (const [id, parts] of rendered.cells) if (!plan.adoptedCells.has(id)) cells.set(id, parts);
	return { cells, calls: rendered.calls, ids };
}

/** Sends an early event to a handler, with the element that handles it as its current target. */
export type Replay = (handler: number, event: unknown, currentTarget: number) => void;

/**
 * Replays the events the first frame heard, in order, through the handlers the background bound:
 * one a drawn element's listener heard goes to the handler in the same slot; one the page caught
 * goes from its target up, as Lynx bubbles it (a `catch` stops it).
 */
export function replayEarly(options: {
	frame: Frame;
	applier: Applier;
	rendered: Rendered;
	ids: Map<number, number>;
	send: Replay;
}): void {
	const { frame, applier, rendered, ids, send } = options;
	for (const early of frame.early) {
		const at = ids.get(early.at);
		if (at === undefined) continue;
		if (early.slot !== null) {
			const handler = applier.handlerOf(at, early.slot);
			if (handler !== undefined) send(handler, early.event, at);
			continue;
		}
		for (let id = at; id !== ROOT_ID && id !== 0; id = rendered.nodes.get(id)?.parent ?? 0) {
			const caught = applier.handlerOf(id, `catchEvent:${early.name}`);
			const bound = caught ?? applier.handlerOf(id, `bindEvent:${early.name}`);
			if (bound !== undefined) send(bound, early.event, id);
			if (caught !== undefined) break;
		}
	}
	frame.early.length = 0;
}
