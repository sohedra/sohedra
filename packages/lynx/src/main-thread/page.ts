// What the main thread keeps of the page it shows, in one object: the runtime reads and changes it,
// and nothing else of the page lives in a module's variables or on the global object.

import type { CallItem, PatchParams } from "../wire/index.ts";
import type { Applier } from "./apply.ts";
import { createCodeStyles } from "./code-styles.ts";
import type { CodeStyles } from "./code-styles.ts";
import { createFlattening } from "./flatten.ts";
import type { Flattening } from "./flatten.ts";
import type { Frame } from "./frame/draw.ts";
import type { LynxElement } from "./globals.ts";

/** The main thread's page. */
export interface MainThreadPage {
	/** The page the main thread shows: bumped when the page reloads and when it ends. */
	generation: number;
	/** Lynx's page element, once the engine rendered the page. */
	element: LynxElement | undefined;
	/** The applier of the page shown, or being made. */
	applier: Applier | undefined;
	/** The elements of the page before, shown until the new page's patch replaces them. */
	previous: Applier[];
	/** Patches that came before the engine rendered the page. */
	early: PatchParams[];
	/** The page's life has ended: a patch that comes after is for no page, and is dropped. */
	destroyed: boolean;
	/** Whether the background's page is shown: a patch of it was applied. */
	shown: boolean;
	/** The ops of each list cell the list has not shown yet, as they came. */
	cells: Map<number, string[]>;
	/** The first frame, until the background's first patch hydrates it. */
	frame: Frame | undefined;
	/**
	 * The background was asked to write the page again: until its rewrite comes, the patches' ops
	 * are dropped (the rewrite holds what they did), and their calls wait for it.
	 */
	rewriting: boolean;
	/** The calls that wait for the rewrite, with their patches' pages. */
	held: { item: CallItem; stamp: number }[];
	/** A patch dropped while waiting for the rewrite showed new data: the rewrite's flush says so. */
	dataHeld: boolean;
	/** The styles code set and the elements held for a UI, which hydration carries over. */
	styles: CodeStyles;
	flattening: Flattening;
}

/** A page before the engine renders it. */
export function createMainThreadPage(): MainThreadPage {
	return {
		generation: 0,
		element: undefined,
		applier: undefined,
		previous: [],
		early: [],
		destroyed: false,
		shown: false,
		cells: new Map(),
		frame: undefined,
		rewriting: false,
		held: [],
		dataHeld: false,
		styles: createCodeStyles(),
		flattening: createFlattening(),
	};
}

/** Takes the old pages off the screen: the new page's elements go in before the same flush. */
export function clearPrevious(page: MainThreadPage): void {
	for (const old of page.previous.splice(0)) old.clear();
}
