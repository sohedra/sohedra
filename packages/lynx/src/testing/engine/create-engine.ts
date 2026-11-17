// The engine fake: what Lynx's main thread does with the page's elements, on a DOM.

import { testDocument } from "../globals.ts";
import { propertyFunctions } from "./properties.ts";
import type { PropertyFunctions } from "./properties.ts";
import { stateOf } from "./state.ts";
import type { ElementState, EngineState } from "./state.ts";
import { descendantsOf, isText, treeFunctions } from "./tree.ts";
import type { TreeFunctions } from "./tree.ts";
import type { LynxElement } from "./types.ts";

/** Lynx's main-thread functions that act on elements. */
export type ElementFunctions = TreeFunctions & PropertyFunctions;

/** Where an engine puts its page. */
export interface EngineOptions {
	/** The document the elements are made in; the test environment's by default. */
	document?: Document;
	/** The element the page goes in; the document's body by default. */
	container?: Element;
}

/** One engine: the main thread's element functions and the engine's own side of them. */
export interface Engine {
	/** The functions the page's main thread calls: Lynx installs them as globals. */
	readonly functions: ElementFunctions;
	/** The `<page>` element, once the main thread made it. */
	page(): LynxElement | undefined;
	/** The elements under `root` (the page by default), `root` first, depth first. */
	all(root?: LynxElement): LynxElement[];
	/** The visible text of an element: its raw-text descendants. */
	text(element: LynxElement): string;
	/** The `<text>` elements' contents, in document order. */
	texts(): string[];
	/** What the engine keeps of an element. Read it, don't change it. */
	state(element: LynxElement): ElementState;
	/** Any element made so far, attached or not, by unique id. */
	byUid(uid: number): LynxElement | undefined;
	/** How many elements with this tag were ever made. */
	madeCount(tag: string): number;
	/**
	 * Drops the engine's hold on an element and what is under it. On a device an element that
	 * nothing refers to any more is destroyed; here the registry would keep it for good. For tests
	 * about what the page lets go of once an element is gone.
	 */
	forget(uid: number): void;
	/** Takes the page out of the document and lets go of every element. */
	dispose(): void;
}

/** Makes an engine. It needs a DOM: the test environment's, or the one given. */
export function createEngine(options: EngineOptions = {}): Engine {
	const document = options.document ?? testDocument();
	const engine: EngineState = {
		document,
		container: options.container ?? document.body,
		nextUid: 1,
		page: undefined,
		states: new WeakMap(),
		made: new Map(),
		unflushed: new Set(),
		stale: new Set(),
		flattening: false,
		respond: () => ({ code: 0 }),
		log: {
			flushes: [],
			invocations: [],
			animations: [],
			workletEvents: [],
			filings: [],
			gestureCalls: [],
			mainThreadRuns: [],
			gestureManagerCalls: [],
		},
	};
	const functions: ElementFunctions = { ...treeFunctions(engine), ...propertyFunctions(engine) };

	function text(element: LynxElement): string {
		return isText(element)
			? (element.textContent ?? "")
			: [...element.childNodes].map((child) => text(child as LynxElement)).join("");
	}

	return {
		functions,
		page: () => engine.page,
		all: (root = engine.page) => (root ? descendantsOf(root) : []),
		text,
		texts() {
			return engine.page
				? descendantsOf(engine.page)
						.filter((element) => engine.states.get(element)?.tag === "text")
						.map(text)
				: [];
		},
		state: (element) => stateOf(engine, element, "state", 0),
		byUid: (uid) => engine.made.get(uid)?.node,
		madeCount: (tag) => [...engine.made.values()].filter((state) => state.tag === tag).length,
		forget(uid) {
			const root = engine.made.get(uid);
			if (!root) return;
			for (const element of descendantsOf(root.node)) {
				const state = engine.states.get(element);
				if (state) engine.made.delete(state.uid);
			}
		},
		dispose() {
			engine.page?.parentNode?.removeChild(engine.page);
			engine.page = undefined;
			engine.made.clear();
			engine.unflushed.clear();
			engine.stale.clear();
		},
	};
}
