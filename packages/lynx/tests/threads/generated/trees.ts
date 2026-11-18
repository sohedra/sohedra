// A page's tree as lines of text, read from the engine (what Lynx shows) or from the background's
// renderer (what Svelte rendered), so the two compare line by line. Both are read the same way:
// an element's tag, its classes, id, styles, dataset, other attributes and bound events; the texts
// of a text element joined into runs, empty ones dropped; a list as its cells, each one asked of
// Lynx in turn (`show`) on the engine, and each `<list-item>` on the background. Anchors, fragments
// and the order attributes were set in are not part of what a page shows.

import type { TreeNode } from "../../../src/background/renderer/node.ts";
import { pageRenderer } from "../../../src/background/renderer/page-renderer.ts";
import { attrValue, textOf } from "../../../src/background/renderer/values.ts";
import { LIST_ONLY_INFO } from "../../../src/main-thread/lists.ts";
import { parseStyleText } from "../../../src/testing/engine/dom.ts";
import type { Engine, LynxElement } from "../../../src/testing/index.ts";
import { ROOT_ID, TEXT_CONTAINERS } from "../../../src/wire/index.ts";

/** How a tree is read. */
export interface Reading {
	/**
	 * A list as every cell, asked of Lynx in order (`cells`), or as the keys of the items Lynx was
	 * told of, with no cell asked for (`keys`).
	 */
	lists: "cells" | "keys";
	/** Whether each element's bound events are read. */
	events: boolean;
}

/** Everything: every cell, and the events. */
const WHOLE: Reading = { lists: "cells", events: true };

interface ReadElement {
	tag: string;
	classes: string;
	id: string | null;
	styles: [string, string][];
	dataset: Record<string, unknown>;
	attrs: Record<string, unknown>;
	events: string[];
}

/** An element as one line: its tag and what it shows, in a fixed order. */
function line(element: ReadElement, depth: number, reading: Reading): string {
	const parts = [element.tag];
	const classes = element.classes.trim();
	if (classes !== "") parts.push(`class=${JSON.stringify(classes.split(/\s+/).join(" "))}`);
	if (element.id !== null && element.id !== "") parts.push(`id=${JSON.stringify(element.id)}`);
	if (element.styles.length > 0) {
		const styles = element.styles.map(([name, value]) => `${name}: ${value}`).join("; ");
		parts.push(`style=${JSON.stringify(styles)}`);
	}
	for (const key of Object.keys(element.dataset).sort())
		parts.push(`data-${key}=${JSON.stringify(textOf(element.dataset[key]))}`);
	for (const key of Object.keys(element.attrs).sort())
		parts.push(`${key}=${JSON.stringify(textOf(element.attrs[key]))}`);
	if (reading.events) for (const event of [...element.events].sort()) parts.push(`@${event}`);
	return "  ".repeat(depth) + parts.join(" ");
}

/** Texts and child elements as lines: adjacent texts joined into one run, empty runs dropped. */
function childLines<Child>(options: {
	children: Iterable<Child>;
	depth: number;
	/** A text's text, or undefined for an element. */
	text: (child: Child) => string | undefined;
	element: (child: Child) => string[];
}): string[] {
	const lines: string[] = [];
	let run: string | undefined;
	const end = (): void => {
		if (run) lines.push(`${"  ".repeat(options.depth)}${JSON.stringify(run)}`);
		run = undefined;
	};
	for (const child of options.children) {
		const text = options.text(child);
		if (text !== undefined) {
			run = (run ?? "") + text;
			continue;
		}
		end();
		lines.push(...options.element(child));
	}
	end();
	return lines;
}

// ---- The engine ----------------------------------------------------------------------------

/**
 * The type of an event a listener is bound as, by its `bind_type`, as Lynx numbers them
 * (core/renderer/events/events.h): the background's names for them.
 */
const EVENT_TYPES: Record<number, string> = {
	1: "bindEvent",
	2: "capture-bind",
	3: "capture-catch",
	4: "catchEvent",
};

/** The DOM's `nodeType` of a text node: a raw text in the engine. */
const TEXT_NODE = 3;

/** The key of each item Lynx was told of, in order, from the list's updates. */
export function listKeys(engine: Engine, list: LynxElement): string[] {
	let keys: string[] = [];
	for (const update of engine.list(list).updates) {
		const removed = new Set(update.removeAction.map(Number));
		keys = keys.filter((_, index) => !removed.has(index));
		const inserted = [...update.insertAction].sort(
			(a, b) => Number(a["position"]) - Number(b["position"]),
		);
		for (const insert of inserted)
			keys.splice(Number(insert["position"]), 0, String(insert["item-key"]));
	}
	return keys;
}

function engineElement(
	engine: Engine,
	element: LynxElement,
	depth: number,
	reading: Reading,
): string[] {
	const state = engine.state(element);
	const attrs: Record<string, unknown> = {};
	for (const [key, value] of Object.entries(state.attrs)) if (value != null) attrs[key] = value;
	const read: ReadElement = {
		tag: state.tag,
		classes: state.classes,
		id: state.id,
		styles: [...state.inlineStyles],
		dataset: state.dataset,
		attrs,
		events: state.listeners.map(
			(listener) => `${EVENT_TYPES[listener.options.bind_type ?? 0] ?? "?"}:${listener.name}`,
		),
	};
	const lines = [line(read, depth, reading)];
	if (state.list) {
		if (reading.lists === "keys") {
			lines.push(`${"  ".repeat(depth + 1)}keys ${JSON.stringify(listKeys(engine, element))}`);
			return lines;
		}
		const handle = engine.list(element);
		for (let index = 0; index < state.list.items; index++)
			lines.push(...engineElement(engine, handle.show(index), depth + 1, reading));
		return lines;
	}
	const inText = TEXT_CONTAINERS.has(state.tag);
	return [
		...lines,
		...childLines({
			// Boundary: the engine's tree holds its elements and raw texts only.
			children: [...element.childNodes] as LynxElement[],
			depth: depth + 1,
			text: (child) =>
				child.nodeType === TEXT_NODE ? (inText ? (child.textContent ?? "") : "") : undefined,
			element: (child) => engineElement(engine, child, depth + 1, reading),
		}),
	];
}

/** What the engine shows: the page's tree, under its `<page>`. */
export function engineTree(engine: Engine, reading: Reading = WHOLE): string[] {
	const page = engine.page();
	return page ? engineElement(engine, page, 0, reading) : [];
}

// ---- The background ------------------------------------------------------------------------

/**
 * What the renderer keeps that the main thread never sets as an attribute: `flatten`, and what
 * only the list reads of its items.
 */
const RENDERER_ONLY = new Set(["flatten", ...LIST_ONLY_INFO]);

/** The element and text children of `node`, through fragments, in order. */
function* childrenOf(node: TreeNode): Generator<TreeNode> {
	for (let child = node.first; child; child = child.next) {
		if (child.kind === "fragment") yield* childrenOf(child);
		else if (child.kind !== "comment") yield child;
	}
}

function backgroundElement(node: TreeNode, depth: number, reading: Reading): string[] {
	const read: ReadElement = {
		tag: node.tag!,
		classes: "",
		id: null,
		styles: [],
		dataset: {},
		attrs: {},
		events: [...(node.events?.keys() ?? [])],
	};
	for (const [key, value] of node.attrs ?? []) {
		if (typeof value === "function" || RENDERER_ONLY.has(key)) continue;
		const sent = attrValue(key, value);
		if (sent === null) continue;
		if (key === "class") read.classes = textOf(sent);
		else if (key === "id") read.id = textOf(sent);
		else if (key === "style") read.styles = parseStyleText(textOf(sent));
		else if (key.startsWith("data-")) read.dataset[key.slice(5)] = sent;
		else read.attrs[key] = sent;
	}
	for (const [key, value] of node.codeStyles ?? []) {
		read.styles = read.styles.filter(([name]) => name !== key);
		read.styles.push([key, textOf(value)]);
	}
	const lines = [line(read, depth, reading)];
	if (read.tag === "list") {
		const items = [...childrenOf(node)].filter((child) => child.kind === "element");
		if (reading.lists === "keys") {
			const keys = items.map((item) => textOf(item.attrs?.get("item-key") ?? ""));
			lines.push(`${"  ".repeat(depth + 1)}keys ${JSON.stringify(keys)}`);
			return lines;
		}
		for (const item of items) lines.push(...backgroundElement(item, depth + 1, reading));
		return lines;
	}
	const inText = TEXT_CONTAINERS.has(read.tag);
	return [
		...lines,
		...childLines({
			children: childrenOf(node),
			depth: depth + 1,
			text: (child) => (child.kind === "text" ? (inText ? (child.data ?? "") : "") : undefined),
			element: (child) => backgroundElement(child, depth + 1, reading),
		}),
	];
}

/** What Svelte rendered on the background: the page's tree, under its root. */
export function backgroundTree(reading: Reading = WHOLE): string[] {
	const root = pageRenderer.nodeById(ROOT_ID);
	return root ? backgroundElement(root, 0, reading) : [];
}

/** Throws, with both trees, unless what Lynx shows is what the background rendered. */
export function expectSameTree(shown: string[], rendered: string[], what = "Lynx shows"): void {
	const a = shown.join("\n");
	const b = rendered.join("\n");
	if (a !== b) throw new Error(`${what}:\n${a}\n\nbut the background rendered:\n${b}`);
}
