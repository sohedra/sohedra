// An element as main-thread functions see it: an event's `target` and `currentTarget`, a ref's
// `current`, what a query finds. The engine has no such object, only element functions, so each
// method here is one of them. One wrapper stands for one engine element while it lives, so the
// same element is the same object wherever a function meets it (`event.target === ref.current`);
// the page forgets it when it lets go of the element, and a list row made again gets new ones.
//
// A wrapper kept past its element's life (in a ref, a closure) is gone: it answers no tree
// question, and a change through it is reported and does nothing, so it never wraps released
// elements again.
//
// The tree questions use the background node's names: `parentElement`, `contains`, `dataset`.
// Styles set here go through the page's store of styles set from code, so a `style` the background
// writes later keeps them, as it keeps its own.

import type { SentTarget } from "../../wire/index.ts";
import { mainThreadError } from "../catalogue.ts";
import type { CodeStyles } from "../code-styles.ts";
import type { Flattening } from "../flatten.ts";
import { mainThread } from "../globals.ts";
import type { InvokeResult, LynxElement } from "../globals.ts";

/** Lynx's answer to a UI method on an element with no view: "no UI for this node". */
const NO_UI = 6;

/** What the wrappers of one page reach. */
export interface ElementScope {
	styles: CodeStyles;
	flattening: Flattening;
	/** A method changed the element: the change reaches the screen at the next flush. */
	changed(what: string, detail: unknown): void;
	/**
	 * Runs a UI method's call: now, or, while the page applies a patch, once the patch is flushed
	 * and laid out, so it finds the element's view.
	 */
	invoke(run: () => void): void;
	/** The wrapper of an engine element. */
	wrap(element: LynxElement): MainThreadElement;
	/** The background's id of an engine element, while the page holds it. */
	idOf(element: LynxElement): number | undefined;
	report(error: unknown): void;
}

/** One of `__ElementAnimate`'s operations. */
const ANIMATE = { start: 0, play: 1, pause: 2, cancel: 3 } as const;

let animations = 0;

/** An animation a main-thread function started on an element. */
export class MainThreadAnimation {
	readonly id: string;
	private readonly element: LynxElement;

	constructor(element: LynxElement, keyframes: unknown[], options: Record<string, unknown>) {
		this.element = element;
		this.id = `__sohedra-lynx-main-thread-animation-${animations++}`;
		mainThread.__ElementAnimate(element, [ANIMATE.start, this.id, keyframes, options]);
	}

	cancel(): void {
		mainThread.__ElementAnimate(this.element, [ANIMATE.cancel, this.id]);
	}

	pause(): void {
		mainThread.__ElementAnimate(this.element, [ANIMATE.pause, this.id]);
	}

	play(): void {
		mainThread.__ElementAnimate(this.element, [ANIMATE.play, this.id]);
	}
}

/** An element as main-thread functions see it. */
export class MainThreadElement {
	/** The engine's element: not enumerable, so no walk or copy of the wrapper meets it. */
	declare private readonly node: LynxElement;
	/** The page's scope, the same way. */
	declare private readonly scope: ElementScope;

	/** The page let go of the element: the wrapper is gone. */
	declare private gone: boolean;

	constructor(element: LynxElement, scope: ElementScope) {
		Object.defineProperty(this, "node", { value: element });
		Object.defineProperty(this, "scope", { value: scope });
		Object.defineProperty(this, "gone", { value: false, writable: true });
	}

	/** The page let go of the element. */
	leave(): void {
		this.gone = true;
	}

	/** Whether a change through the wrapper may go: one through a gone wrapper is reported. */
	private live(method: string): boolean {
		if (!this.gone) return true;
		this.scope.report(mainThreadError({ code: "element_released", details: { method } }));
		return false;
	}

	/** The element that holds this one; null for the page, and for a gone element. */
	get parentElement(): MainThreadElement | null {
		if (this.gone) return null;
		const parent = mainThread.__GetParent(this.node);
		return parent ? this.scope.wrap(parent) : null;
	}

	/** Whether `other` is this element or inside it. */
	contains(other: unknown): boolean {
		if (this.gone || !(other instanceof MainThreadElement) || other.gone) return false;
		const self = this.node;
		for (
			let element: LynxElement | null | undefined = other.node;
			element;
			element = mainThread.__GetParent(element)
		)
			if (element === self) return true;
		return false;
	}

	/** The element's `data-*` values, without the prefix. */
	get dataset(): Record<string, unknown> {
		return this.gone ? {} : { ...mainThread.__GetDataset(this.node) };
	}

	setAttribute(name: string, value: unknown): void {
		if (!this.live("setAttribute")) return;
		mainThread.__SetAttribute(this.node, name, value);
		this.scope.changed("setAttribute", name);
	}

	/** Sets one inline style; `null` or "" gives the property back to `style`. */
	setStyleProperty(name: string, value: string | number | null): void {
		if (!this.live("setStyleProperty")) return;
		this.scope.styles.set(this.node, { [name]: value });
		this.scope.changed("setStyleProperty", name);
	}

	/** Sets inline styles, as `setStyleProperty` does each. */
	setStyleProperties(styles: Record<string, string | number | null>): void {
		if (!this.live("setStyleProperties")) return;
		this.scope.styles.set(this.node, styles);
		this.scope.changed("setStyleProperties", Object.keys(styles).join(", "));
	}

	getAttribute(name: string): unknown {
		return this.gone ? null : mainThread.__GetAttributeByName(this.node, name);
	}

	getAttributeNames(): string[] {
		return this.gone ? [] : mainThread.__GetAttributeNames(this.node);
	}

	querySelector(selector: string): MainThreadElement | null {
		const found = this.gone ? null : mainThread.__QuerySelector(this.node, selector, {});
		return found ? this.scope.wrap(found) : null;
	}

	querySelectorAll(selector: string): MainThreadElement[] {
		if (this.gone) return [];
		return mainThread
			.__QuerySelectorAll(this.node, selector, {})
			.map((found) => this.scope.wrap(found));
	}

	getComputedStyleProperty(name: string): string {
		return this.gone ? "" : mainThread.__GetComputedStyleByKey(this.node, name);
	}

	/** Animates the element; a number is the duration in milliseconds. */
	animate(
		keyframes: Record<string, string | number>[],
		options?: number | Record<string, unknown>,
	): MainThreadAnimation {
		if (this.gone)
			throw mainThreadError({ code: "element_released", details: { method: "animate" } });
		const element = this.node;
		this.scope.flattening.hold(element);
		const animation = new MainThreadAnimation(
			element,
			keyframes,
			typeof options === "number" ? { duration: options } : (options ?? {}),
		);
		this.scope.changed("animate", animation.id);
		return animation;
	}

	/** Calls Lynx's UI method `method` of the element and resolves with its answer. */
	invoke(method: string, params: Record<string, unknown> = {}): Promise<unknown> {
		if (this.gone)
			return Promise.reject(mainThreadError({ code: "element_released", details: { method } }));
		const element = this.node;
		this.scope.flattening.hold(element);
		this.scope.changed("invoke", method);
		return new Promise((resolve, reject) => {
			this.scope.invoke(() =>
				mainThread.__InvokeUIMethod(element, method, params, (result: InvokeResult) => {
					if (result.code === 0) resolve(result.data ?? null);
					else if (result.code === NO_UI)
						reject(mainThreadError({ code: "element_has_no_view", details: { method } }));
					else
						reject(
							mainThreadError({ code: "ui_method_failed", details: { method, code: result.code } }),
						);
				}),
			);
		});
	}

	/**
	 * The element as it crosses to the background, as an event's target does: the background's id
	 * of it (`element`, 0 once gone), its `id`, Lynx's id of it and its dataset.
	 */
	toJSON(): SentTarget {
		if (this.gone) return { element: 0 };
		const id = mainThread.__GetID(this.node);
		return {
			element: this.scope.idOf(this.node) ?? 0,
			id: typeof id === "string" ? id : "",
			uid: mainThread.__GetElementUniqueID(this.node),
			dataset: this.dataset,
		};
	}
}

/** The wrappers of one page's elements, one for each. */
export interface Elements {
	wrap(element: LynxElement): MainThreadElement;
	/** The page let go of the element: its wrapper goes. */
	forget(element: LynxElement): void;
	/** The wrapper of the element, if one was made. */
	find(element: LynxElement): MainThreadElement | undefined;
	readonly size: number;
}

/** The wrappers of one page, made as functions meet the elements. */
export function createElements(scope: Omit<ElementScope, "wrap">): Elements {
	// A map, emptied as the page lets go of each element: an engine element a weak map held would
	// stay as long as its wrapper, which holds it.
	const wrappers = new Map<LynxElement, MainThreadElement>();
	const full: ElementScope = { ...scope, wrap };
	function wrap(element: LynxElement): MainThreadElement {
		let wrapper = wrappers.get(element);
		if (!wrapper) wrappers.set(element, (wrapper = new MainThreadElement(element, full)));
		return wrapper;
	}
	return {
		wrap,
		forget(element) {
			wrappers.get(element)?.leave();
			wrappers.delete(element);
		},
		find: (element) => wrappers.get(element),
		get size() {
			return wrappers.size;
		},
	};
}
