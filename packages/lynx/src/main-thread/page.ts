// What the main thread keeps of the page it shows, in one object: the runtime reads and changes it,
// and nothing else of the page lives in a module's variables or on the global object.

import type { CallItem, PatchParams } from "../wire/index.ts";
import type { Applier } from "./apply.ts";
import { createCodeStyles } from "./code-styles.ts";
import type { CodeStyles } from "./code-styles.ts";
import { createFlattening } from "./flatten.ts";
import type { Flattening } from "./flatten.ts";
import type { Frame } from "./frame/draw.ts";
import type { FunctionsPage } from "./functions/page.ts";
import type { LynxElement } from "./globals.ts";
import { createInputNumbers } from "./inputs.ts";
import type { InputNumbers } from "./inputs.ts";

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
	/** Patches that came before the engine rendered the page, or before its first frame painted. */
	early: PatchParams[];
	/** The first frame is drawn, and the platform has not painted it yet: patches wait. */
	painting: boolean;
	/** The page's life has ended: a patch that comes after is for no page, and is dropped. */
	destroyed: boolean;
	/** Whether the background's page is shown: a patch of it was applied. */
	shown: boolean;
	/**
	 * The page did not start (its root threw on the background): what it shows stays, and no patch
	 * of it is applied, until a reload.
	 */
	notStarted: boolean;
	/**
	 * The ops of each list cell that has no elements, as they came: one Lynx never showed, or one
	 * let go of, whose text the background wrote again.
	 */
	cells: Map<number, string[]>;
	/** The function contexts the texts of each cell in `cells` hold, when any do. */
	cellContexts: Map<number, number[]>;
	/** The first frame, until the background's first patch hydrates it. */
	frame: Frame | undefined;
	/**
	 * The background was asked to write the page again: until its rewrite comes, the patches' ops
	 * are dropped (the rewrite holds what they did), and their calls wait for it.
	 */
	rewriting: boolean;
	/** The calls that wait for the rewrite, with their patches' generations. */
	waitingCalls: { item: CallItem; generation: number }[];
	/** A patch dropped while waiting for the rewrite showed new data: the rewrite's flush says so. */
	dataHeld: boolean;
	/** The styles code set and the elements held for a UI, which hydration carries over. */
	styles: CodeStyles;
	flattening: Flattening;
	/** The page's main-thread functions: a page that reloads starts new ones. */
	functions: FunctionsPage;
	/** The numbers of the fields' `input` events, which hydration carries over. */
	inputs: InputNumbers;
}

/** A page before the engine renders it; `functions` makes its main-thread functions. */
export function createMainThreadPage(
	functions: (scope: { styles: CodeStyles; flattening: Flattening }) => FunctionsPage,
): MainThreadPage {
	const styles = createCodeStyles();
	const flattening = createFlattening();
	return {
		generation: 0,
		element: undefined,
		applier: undefined,
		previous: [],
		early: [],
		painting: false,
		destroyed: false,
		shown: false,
		notStarted: false,
		cells: new Map(),
		cellContexts: new Map(),
		frame: undefined,
		rewriting: false,
		waitingCalls: [],
		dataHeld: false,
		styles,
		flattening,
		functions: functions({ styles, flattening }),
		inputs: createInputNumbers(),
	};
}

/** Takes the old pages off the screen: the new page's elements go in before the same flush. */
export function clearPrevious(page: MainThreadPage): void {
	for (const old of page.previous.splice(0)) old.clear();
}
