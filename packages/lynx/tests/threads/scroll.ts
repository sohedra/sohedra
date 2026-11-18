// A `<list>` scrolled as Lynx scrolls it on a device: it holds the cells of one screen of items and
// `preload-buffer-count` more on each side, asks for a cell that comes into that window and hands
// back one that leaves it, except the cell of an item that is not recyclable
// (core/renderer/ui_component/list/list_children_helper.cc, list_layout_manager.cc).

import type { Engine, LynxElement } from "../../src/testing/index.ts";
import { listKeys } from "./generated/trees.ts";

/** The cells Lynx held on screen in the device's feed of 15-element rows, at rest. */
export const SCREEN = 9;

/** Whether Lynx may hand back the cell of the item with this key: as it was told last. */
export function recyclable(engine: Engine, list: LynxElement, key: string): boolean {
	const updates = engine.list(list).updates;
	for (let index = updates.length - 1; index >= 0; index--) {
		const { insertAction, updateAction } = updates[index]!;
		const told = [...updateAction, ...insertAction].find((info) => info["item-key"] === key);
		if (told) return told["recyclable"] !== false;
	}
	return true;
}

/** A list Lynx scrolls. */
export interface Scroller {
	/** Shows the items from `first` on, and hands back the cells that leave the window. */
	to(first: number): void;
	/** The cells Lynx holds now, by their item's key. */
	readonly bound: ReadonlyMap<string, LynxElement>;
}

/** Scrolls `list` with `screen` items on screen and `preload` more held on each side. */
export function scroller(
	engine: Engine,
	list: LynxElement,
	{ screen = SCREEN, preload = 0 }: { screen?: number; preload?: number } = {},
): Scroller {
	const bound = new Map<string, LynxElement>();
	return {
		bound,
		to(first) {
			const keys = listKeys(engine, list);
			const from = Math.max(0, first - preload);
			const window = keys.slice(from, first + screen + preload);
			const shown = new Set(window);
			for (const [key, cell] of bound) {
				if (shown.has(key) || !recyclable(engine, list, key)) continue;
				engine.list(list).hide(cell);
				bound.delete(key);
			}
			for (const [offset, key] of window.entries()) {
				if (!bound.has(key)) bound.set(key, engine.list(list).show(from + offset));
			}
		},
	};
}

/** Scrolls one item at a time from `from` to `to`, letting the threads settle every `step` items. */
export async function scrollThrough(options: {
	scroll: Scroller;
	from: number;
	to: number;
	settle: () => Promise<void>;
	step?: number;
}): Promise<void> {
	const { scroll, from, to, settle, step = 4 } = options;
	const direction = to >= from ? 1 : -1;
	for (let first = from; first !== to + direction; first += direction) {
		scroll.to(first);
		if ((first - from) % step === step - 1) await settle();
	}
	await settle();
}
