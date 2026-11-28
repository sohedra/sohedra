// The web platform: core's Platform contract on the DOM, and the web's platform types.
import type {
	CollatorOptions,
	FocusOptions as PlatformFocusOptions,
	NumberFormatOptions,
	Platform,
	PlatformTypes,
	REASONS,
	Scheduler,
} from "@sohedra/primitives-core/foundation/kernel";

// One `requestAnimationFrame` runs every frame callback requested before it, in request order,
// so that what the callbacks change (popups unmounting after their exit
// animations) lands before any microtask one of them queues runs. A canceled callback is skipped.
let frameQueue: { run: (() => void) | null }[] = [];
// The `requestAnimationFrame` the pending frame was requested from: a different one (fake timers
// installed meanwhile) gets its own request, so the fake clock drives the queue.
let frameRequestedFrom: unknown = null;

function runFrame() {
	frameRequestedFrom = null;
	const queue = frameQueue;
	frameQueue = [];
	for (const entry of queue) {
		entry.run?.();
	}
}

// Timer globals are read at call time, so tests that install fake timers later still drive them.
/** Timers, frames, microtasks and `performance.now()`, the clock of `event.timeStamp`. */
export const webScheduler: Scheduler = /* @__PURE__ */ Object.freeze({
	timeout(callback: () => void, ms: number) {
		const handle = globalThis.setTimeout(callback, ms);
		return () => globalThis.clearTimeout(handle);
	},
	// The shared animation frame, or a 16ms timeout where there are no frames.
	frame(callback: () => void) {
		if (typeof globalThis.requestAnimationFrame === "function") {
			const entry = { run: callback as (() => void) | null };
			frameQueue.push(entry);
			if (frameRequestedFrom !== globalThis.requestAnimationFrame) {
				frameRequestedFrom = globalThis.requestAnimationFrame;
				globalThis.requestAnimationFrame(runFrame);
			}
			return () => {
				entry.run = null;
			};
		}
		const handle = globalThis.setTimeout(callback, 16);
		return () => globalThis.clearTimeout(handle);
	},
	microtask(callback: () => void) {
		let canceled = false;
		globalThis.queueMicrotask(() => {
			if (!canceled) {
				callback();
			}
		});
		return () => {
			canceled = true;
		};
	},
	now: () => globalThis.performance?.now() ?? Date.now(),
});

function compare(a: Element, b: Element): number {
	if (a === b) {
		return 0;
	}
	const position = a.compareDocumentPosition(b);
	if (position & Node.DOCUMENT_POSITION_DISCONNECTED) {
		// Separate trees (shadow roots) have no order; a detached element sorts last.
		return a.isConnected === b.isConnected ? 0 : a.isConnected ? -1 : 1;
	}
	if (position & Node.DOCUMENT_POSITION_FOLLOWING) {
		return -1;
	}
	return position & Node.DOCUMENT_POSITION_PRECEDING ? 1 : 0;
}

function focus(target: Element, options?: PlatformFocusOptions): void {
	if (!("focus" in target) || typeof target.focus !== "function") {
		return;
	}
	const { focusVisible, preventScroll } = options ?? {};
	if (focusVisible === undefined && preventScroll === undefined) {
		(target as HTMLElement).focus();
	} else {
		const focusOptions: FocusOptions & { focusVisible?: boolean | undefined } = {
			preventScroll,
			focusVisible,
		};
		(target as HTMLElement).focus(focusOptions);
	}
	if (options?.select && target.tagName === "INPUT") {
		(target as HTMLInputElement).select();
	}
}

// One formatter or collator per locale and options, as building one is slow.
const formatters = new Map<string, Intl.NumberFormat>();
const collators = new Map<string, Intl.Collator>();

/** A cache key for a locales argument: an `Intl.Locale` by its tag (`JSON.stringify` gives `{}`). */
function stringifyLocale(locales: unknown): string {
	if (Array.isArray(locales)) {
		return locales.map(stringifyLocale).join(",");
	}
	if (locales == null) {
		return "";
	}
	if (locales instanceof Intl.Locale) {
		return locales.toString();
	}
	return typeof locales === "string" ? locales : JSON.stringify(locales);
}

function numberFormat(locales: unknown, options?: NumberFormatOptions): Intl.NumberFormat {
	const key = JSON.stringify([stringifyLocale(locales), options]);
	let formatter = formatters.get(key);
	if (!formatter) {
		formatter = new Intl.NumberFormat(
			locales as Intl.LocalesArgument,
			options as Intl.NumberFormatOptions,
		);
		formatters.set(key, formatter);
	}
	return formatter;
}

function collator(locales: unknown, options?: CollatorOptions): Intl.Collator {
	const key = JSON.stringify([stringifyLocale(locales), options]);
	let instance = collators.get(key);
	if (!instance) {
		instance = new Intl.Collator(locales as Intl.LocalesArgument, options as Intl.CollatorOptions);
		collators.set(key, instance);
	}
	return instance;
}

/**
 * Submits the control's form: a form-associated control's own (which honours its `form`
 * attribute, so one naming something other than a form submits nothing), else the enclosing one.
 * A form without `requestSubmit` (an old engine, or one a page patched) isn't submitted.
 */
function requestSubmit(control: Element): void {
	const form = "form" in control ? (control as HTMLInputElement).form : control.closest("form");
	if (typeof form?.requestSubmit === "function") {
		form.requestSubmit();
	}
}

/**
 * The web platform every root part passes to its store. Marked pure, so an entry whose parts pass
 * no platform leaves it and the functions it holds out of the bundle.
 */
export const webPlatform: Platform<WebTypes> = /* @__PURE__ */ Object.freeze({
	scheduler: webScheduler,
	order: /* @__PURE__ */ Object.freeze({ compare }),
	focus: /* @__PURE__ */ Object.freeze({ focus }),
	locale: /* @__PURE__ */ Object.freeze({ numberFormat, collator }),
	form: /* @__PURE__ */ Object.freeze({ requestSubmit }),
});

/** The native event per change reason on the web: the type of `eventDetails.event`. */
export type WebEvents = {
	[REASONS.none]: Event;

	[REASONS.triggerPress]: MouseEvent | PointerEvent | TouchEvent | KeyboardEvent;
	[REASONS.triggerHover]: MouseEvent;
	[REASONS.triggerFocus]: FocusEvent;

	[REASONS.outsidePress]: MouseEvent | PointerEvent | TouchEvent;
	[REASONS.itemPress]: MouseEvent | KeyboardEvent | PointerEvent;
	[REASONS.closePress]: MouseEvent | KeyboardEvent | PointerEvent;
	[REASONS.linkPress]: MouseEvent | PointerEvent;
	[REASONS.clearPress]: PointerEvent | MouseEvent | KeyboardEvent;
	[REASONS.chipRemovePress]: PointerEvent | MouseEvent | KeyboardEvent;
	[REASONS.trackPress]: PointerEvent | MouseEvent | TouchEvent;
	[REASONS.incrementPress]: PointerEvent | MouseEvent | TouchEvent;
	[REASONS.decrementPress]: PointerEvent | MouseEvent | TouchEvent;

	[REASONS.inputChange]: InputEvent | Event;
	[REASONS.inputClear]: InputEvent | FocusEvent | Event;
	[REASONS.inputBlur]: FocusEvent;
	[REASONS.inputPaste]: ClipboardEvent;
	[REASONS.inputPress]: MouseEvent | PointerEvent | TouchEvent | KeyboardEvent;

	[REASONS.focusOut]: FocusEvent | KeyboardEvent;
	[REASONS.escapeKey]: KeyboardEvent;
	[REASONS.closeWatcher]: Event;
	[REASONS.listNavigation]: KeyboardEvent;
	[REASONS.keyboard]: KeyboardEvent;

	[REASONS.pointer]: PointerEvent;
	[REASONS.drag]: PointerEvent | TouchEvent;
	[REASONS.swipe]: PointerEvent | TouchEvent;
	[REASONS.wheel]: WheelEvent;
	[REASONS.scrub]: PointerEvent;

	[REASONS.cancelOpen]: MouseEvent;
	[REASONS.siblingOpen]: Event;
	[REASONS.disabled]: Event;
	[REASONS.missing]: Event;
	[REASONS.initial]: Event;
	[REASONS.imperativeAction]: Event;

	[REASONS.windowResize]: UIEvent;
};

/** The web's platform types: elements are DOM elements, events are DOM events, no extra reasons. */
export interface WebTypes extends PlatformTypes {
	element: Element;
	events: WebEvents;
	reasons: never;
}
