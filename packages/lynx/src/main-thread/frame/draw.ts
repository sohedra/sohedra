// Draws the first frame: the page's markup, parsed (./html.ts), made into elements by an applier of
// its own, so attributes, events, datasets and lists are set as the background's ops set them.
// Until the background's first patch adopts them, the frame's listeners keep the events they hear,
// to replay through the background's handlers then. A cell of a list is parsed only when Lynx asks
// for it.

import { listUpdateInfo, OpCode, ROOT_ID } from "../../wire/index.ts";
import type { ListItemInfo, LynxEventType, Op } from "../../wire/index.ts";
import { createApplier } from "../apply.ts";
import type { Applier } from "../apply.ts";
import type { CodeStyles } from "../code-styles.ts";
import type { Flattening } from "../flatten.ts";
import { mainThread } from "../globals.ts";
import type { ListenerOptions, LynxElement } from "../globals.ts";
import { cellInfo, elementsOf, parseCell, parsePage } from "./html.ts";
import type { DrawnCell, DrawnNode } from "./html.ts";

/** An event the first frame heard before the background adopted it. */
export interface EarlyEvent {
	name: string;
	/** The drawn node whose listener heard it (`slot`), or, for one the page caught, its target. */
	at: number;
	/** The listener's slot (`bindEvent:scroll`), or `null` for an event the page caught. */
	slot: string | null;
	/** The event as Lynx gave it. */
	event: unknown;
}

/** The first frame, until the background adopts it. */
export interface Frame {
	/** The drawn page. */
	readonly root: DrawnNode;
	/** The applier that made its elements, by the first frame's ids. */
	readonly applier: Applier;
	/** The events it heard, in order. */
	readonly early: EarlyEvent[];
	/** The drawn node of an id. */
	node(id: number): DrawnNode | undefined;
	/** The cells of a drawn list that have elements, with whether Lynx holds them. */
	held(list: number): Map<number, { bound: boolean }>;
	/** The ops that let go of a drawn node and all under it. */
	releaseOps(id: number, out?: Op[]): Op[];
	/** Stops listening: the drawn elements' listeners and the page's. */
	stop(): void;
}

/** The events the page itself listens to for the first frame: they bubble to it from anywhere. */
const PAGE_EVENTS = ["tap", "longpress"];

/** A capture listener, as the applier binds `capture-bind`. */
const PAGE_CAPTURE: ListenerOptions = { closure_type: 2, bind_type: 2 };

/** What a frame is drawn with. */
export interface DrawOptions {
	page: LynxElement;
	html: string;
	report(error: unknown): void;
	styles: CodeStyles;
	flattening: Flattening;
}

/** Draws the first frame on `page`. Throws, with nothing left on the page, when it cannot. */
export function drawFrame({ page, html, report, styles, flattening }: DrawOptions): Frame {
	let next = ROOT_ID;
	const nextId = (): number => ++next;
	const nodes = new Map<number, DrawnNode>();
	const cells = new Map<number, DrawnCell>();
	const early: EarlyEvent[] = [];
	// The listener slot of each handler id the frame gives: [node, slot].
	const slots: [number, string][] = [];
	const pageListeners: [string, (event: unknown) => void][] = [];

	function record(node: DrawnNode): void {
		nodes.set(node.id, node);
		for (const child of elementsOf(node.children)) record(child);
		for (const cell of node.cells ?? []) cells.set(cell.id, cell);
	}

	function opsOf(node: DrawnNode, out: Op[]): Op[] {
		if (node.tag === "#text") {
			out.push([OpCode.CreateText, node.id, node.text ?? ""]);
			return out;
		}
		out.push([OpCode.Create, node.id, node.tag]);
		for (const [name, value] of node.attrs) out.push([OpCode.SetAttr, node.id, name, value]);
		for (const { type, name } of node.events) {
			slots.push([node.id, `${type}:${name}`]);
			const op: Op = [OpCode.SetEvent, node.id, type as LynxEventType, name, slots.length];
			out.push(op);
		}
		for (const child of elementsOf(node.children)) {
			opsOf(child, out);
			out.push([OpCode.Insert, node.id, child.id, 0]);
		}
		if (node.cells) {
			const items = node.cells.map((cell) => cell.id);
			const infos = new Map<number, ListItemInfo>(
				node.cells.map((cell) => [cell.id, cellInfo(cell)]),
			);
			const info = listUpdateInfo({ committed: [], items, infos, changed: new Set() });
			out.push([OpCode.ListUpdate, node.id, info, items, items, []]);
		}
		return out;
	}

	const applier = createApplier({
		page,
		styles,
		flattening,
		report,
		dispatch(handler, event) {
			const slot = slots[handler - 1];
			if (!slot) return;
			const name = slot[1].slice(slot[1].indexOf(":") + 1);
			// The page's own listener hears these, on their way to their target.
			if (PAGE_EVENTS.includes(name)) return;
			early.push({ name, at: slot[0], slot: slot[1], event });
		},
		// A deferred row of the async list waits for the background's row.
		written: (id) => cells.get(id)?.deferred !== true,
		openCell(id) {
			const cell = cells.get(id);
			if (!cell || cell.node) return;
			const node = parseCell(cell, nextId);
			record(node);
			for (const { error } of applier.apply(opsOf(node, []))) report(error);
		},
	});

	const root = parsePage(html, ROOT_ID, nextId);
	record(root);
	const ops: Op[] = [];
	for (const child of elementsOf(root.children)) {
		opsOf(child, ops);
		ops.push([OpCode.Insert, ROOT_ID, child.id, 0]);
	}
	const failed = applier.apply(ops);
	if (failed.length > 0) {
		// The background's first patch makes the whole page: what was drawn goes.
		applier.silence();
		applier.clear();
		applier.destroy();
		throw failed[0]!.error;
	}
	applier.flushLists();
	for (const name of PAGE_EVENTS) {
		const listener = (event: unknown): void => {
			const uid = (event as { target?: { uid?: unknown } } | null)?.target?.uid;
			const at = typeof uid === "number" ? applier.idForUid(uid) : undefined;
			if (at !== undefined) early.push({ name, at, slot: null, event });
		};
		mainThread.__AddEventListener(page, name, listener, PAGE_CAPTURE);
		pageListeners.push([name, listener]);
	}

	function releaseOps(id: number, out: Op[] = []): Op[] {
		const node = nodes.get(id);
		out.push([OpCode.Release, id]);
		if (!node) return out;
		for (const child of elementsOf(node.children)) releaseOps(child.id, out);
		for (const cell of node.cells ?? []) releaseOps(cell.id, out);
		return out;
	}

	return {
		root,
		applier,
		early,
		node: (id) => nodes.get(id),
		held(list) {
			const held = new Map<number, { bound: boolean }>();
			for (const cell of applier.heldCells(list)) held.set(cell.id, { bound: cell.bound });
			return held;
		},
		releaseOps,
		stop() {
			for (const [name, listener] of pageListeners.splice(0))
				mainThread.__RemoveEventListener(page, name, listener, PAGE_CAPTURE);
			applier.silence();
		},
	};
}
