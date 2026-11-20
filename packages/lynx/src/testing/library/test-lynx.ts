// The Lynx around a rendered page, as a test drives it: the host's data and events, a reload, the
// answers of the elements' UI methods, a list's rows and an element's gestures.

// By the entry's name: an app's augmentation of `@sohedra/lynx/host` reaches the declarations
// bundled for each entry only through it.
import type { HostEvents } from "@sohedra/lynx/host";

import { GestureType } from "../../wire/index.ts";
import { testingError } from "../catalogue.ts";
import type { Detector } from "../engine/state.ts";
import type { InvokeResult, LynxElement } from "../engine/types.ts";
import { rendered, settle } from "./session.ts";
import type { Rendered } from "./session.ts";

/** A Lynx element in a test: a DOM element (`<view>`, `<text>`) in `document.body`. */
export type LynxTestElement = HTMLElement;

/** A UI method call (`node.invoke()`) the page made. */
export interface Invocation {
	element: LynxTestElement;
	method: string;
	params: Record<string, unknown>;
}

/** Answers the page's UI method calls: what Lynx would answer `invoke` with. */
export type InvokeHandler = (call: Invocation) => InvokeResult;

/** An element's box, as `boundingClientRect` gives it, in Lynx's layout units. */
export interface TestRect {
	left: number;
	top: number;
	width: number;
	height: number;
}

/** The kinds of gesture an element's detectors may be: Lynx's gesture types, by name. */
export type GestureKind = Lowercase<Exclude<keyof typeof GestureType, "COMPOSED">>;

/** Each kind, by Lynx's number of it. */
const KINDS: ReadonlyMap<number, GestureKind> = new Map(
	Object.entries(GestureType)
		.filter(([name]) => name !== "COMPOSED")
		// Boundary: the names are `GestureType`'s keys, which `GestureKind` lowers.
		.map(([name, type]) => [type, name.toLowerCase() as GestureKind]),
);

/** What a gesture's callback gets besides the gesture manager: its values and when it happened. */
export interface TestGestureEvent {
	/** The gesture's values (`x`, `y`, `pageX`, `velocityX`), as the event's `params`. */
	params?: Record<string, unknown>;
	/** When it happened, in milliseconds: now by default. */
	timestamp?: number;
}

/** A gesture of an element, as Lynx drives it. */
export interface TestGesture {
	/**
	 * Runs the gesture's callback `name` (`onBegin`, `onUpdate`, `onEnd`) on the main thread, as Lynx
	 * does when the gesture moves, then waits until both threads are idle.
	 */
	fire(name: string, event?: TestGestureEvent): Promise<void>;
}

/** A native `<list>`, as Lynx asks it for its rows while it scrolls. */
export interface TestList {
	/** Lynx shows the item at `index`; returns its `<list-item>`. */
	show(index: number): LynxTestElement;
	/** Lynx hands a shown row back: it scrolled away, and the list may reuse it. */
	hide(row: LynxTestElement): void;
}

/** The Lynx around the page: what a test drives, or answers, in Lynx's place. */
export interface TestLynx {
	/** Answers `invoke` (an element's UI methods); by default every call succeeds with no data. */
	respondInvoke(handler: InvokeHandler): void;
	/** Every UI method call so far. */
	readonly invocations: readonly Invocation[];
	/**
	 * Gives `element` a box: its `boundingClientRect` answers it from now on, whatever
	 * `respondInvoke` answers.
	 */
	setBoundingClientRect(element: Element, rect: TestRect): void;
	/** A native `<list>`, to show and hide its rows as Lynx does while it scrolls. */
	list(element: Element): TestList;
	/** The gesture of an element; `kind` names which, when it has several. */
	gesture(element: Element, kind?: GestureKind): TestGesture;
	/** The host changes its global props, merged into those it has. */
	updateGlobalProps(props: Record<string, unknown>): Promise<void>;
	/** The host sends the page new data, merged into its data. */
	updateInitData(data: Record<string, unknown>): Promise<void>;
	/**
	 * The host sends one of its events, with its arguments: what `on(host, name, …)` hears. An event
	 * `HostEvents` names takes its arguments.
	 */
	sendHostEvent<Name extends string>(
		name: Name,
		...args: Name extends keyof HostEvents ? [args: HostEvents[Name]] : [args?: readonly unknown[]]
	): Promise<void>;
	/** The host reloads the page, with data to add to its data. */
	reload(data?: Record<string, unknown>): Promise<void>;
}

/** The test's Lynx around a rendered page. */
export function createTestLynx(session: Rendered): TestLynx {
	const { page } = session;
	const { engine } = page;
	const rects = new WeakMap<Element, TestRect>();
	let respond: InvokeHandler = () => ({ code: 0 });
	engine.respondWith((method, params, element) => {
		// Boundary: the elements a UI method is called on are the page's, DOM elements.
		const target = element as LynxTestElement;
		const rect = method === "boundingClientRect" ? rects.get(target) : undefined;
		if (rect)
			return {
				code: 0,
				data: { ...rect, right: rect.left + rect.width, bottom: rect.top + rect.height },
			};
		// Boundary: Lynx's UI methods take an object of parameters, which `__InvokeUIMethod` checks.
		return respond({ method, params: params as Record<string, unknown>, element: target });
	});
	const needsBackground = (what: string): void => {
		if (!session.background)
			throw testingError({ code: "background_not_started", details: { what } });
	};
	/** Throws for a call made once the page has ended: `cleanup()` or `unmount()`. */
	const live = (call: string): void => {
		if (rendered() !== session) throw testingError({ code: "no_page_rendered", details: { call } });
	};
	const after = async (what: string, change: () => void): Promise<void> => {
		live(what);
		needsBackground(what);
		change();
		await settle(session);
	};
	return {
		respondInvoke(handler) {
			respond = handler;
		},
		get invocations() {
			// Boundary: the elements a UI method is called on are the page's, DOM elements, and its
			// parameters an object, which `__InvokeUIMethod` checks.
			return engine.invocations.map(({ element, method, params }) => ({
				element: element as LynxTestElement,
				method,
				params: params as Record<string, unknown>,
			}));
		},
		setBoundingClientRect(element, rect) {
			rects.set(element, rect);
		},
		list(element) {
			live("lynx.list()");
			// Boundary: an element of the page is the engine's.
			const target = element as LynxElement;
			if (engine.state(target).tag !== "list")
				throw testingError({ code: "not_a_list", details: { tag: element.localName } });
			const handle = engine.list(target);
			return {
				// Boundary: a list's rows are DOM elements.
				show: (index) => handle.show(index) as LynxTestElement,
				hide: (row) => handle.hide(row),
			};
		},
		gesture(element, kind) {
			live("lynx.gesture()");
			// Boundary: an element of the page is the engine's.
			const target = element as LynxElement;
			const tag = element.localName;
			const detectors = engine.detectors(target);
			const kindOf = (detector: Detector): string =>
				KINDS.get(detector.type) ?? String(detector.type);
			const found =
				kind === undefined ? detectors : detectors.filter((detector) => kindOf(detector) === kind);
			if (found.length === 0)
				throw testingError({ code: "gesture_missing", details: { tag, kind } });
			if (found.length > 1)
				throw testingError({
					code: "gesture_not_named",
					details: { tag, kinds: found.map(kindOf).join(", ") },
				});
			const detector = found[0]!;
			return {
				async fire(name, event = {}) {
					live("lynx.gesture().fire()");
					if (!detector.callbacks.some((callback) => callback.name === name))
						throw testingError({
							code: "gesture_callback_missing",
							details: { kind: kindOf(detector), tag, name },
						});
					engine.fireGesture(target, {
						id: detector.id,
						callback: name,
						...(event.params && { params: event.params }),
						...(event.timestamp !== undefined && { timestamp: event.timestamp }),
					});
					await settle(session);
				},
			};
		},
		updateGlobalProps: (props) =>
			after("lynx.updateGlobalProps()", () => page.updateGlobalProps(props)),
		updateInitData: (data) => after("lynx.updateInitData()", () => page.updateData(data)),
		sendHostEvent: (name: string, ...[args = []]: [args?: readonly unknown[]]) =>
			after("lynx.sendHostEvent()", () => page.emitHostEvent(name, [...args])),
		reload: (data) => after("lynx.reload()", () => page.reload(data)),
	};
}
