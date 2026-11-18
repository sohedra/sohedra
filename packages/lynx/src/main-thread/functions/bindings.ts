// What an element's `main-thread:` attributes bind, by kind: a ref (`main-thread:ref`, a ref or a
// function that gets the element), an event (`main-thread:ontap` and its siblings, in either
// spelling) and a gesture (`main-thread:gesture`, Lynx's detectors: ./gestures.ts). Each kind binds,
// changes, carries a value over at hydration and releases; the store, hydration and the release
// of an element never name a kind.
//
// The engine holds one entry for each event, never the function: a new value is a field written,
// with no gap where the event has no function. A function ref runs at the next settle step, once
// its element is in the tree, before the flush that shows it.

import {
	eventOf,
	isMainThreadFunction,
	isRefHandle,
	MAIN_THREAD_PREFIX,
	removedEventSpelling,
} from "../../wire/index.ts";
import type { LynxEventType, MainThreadFunction } from "../../wire/index.ts";
import type { Flattening } from "../flatten.ts";
import { mainThread } from "../globals.ts";
import type { LynxElement } from "../globals.ts";
import type { Elements } from "./element.ts";
import type { Ref, Refs } from "./refs.ts";
import { prepare } from "./run.ts";
import type { Ready, RunScope } from "./run.ts";

/** What an entry let go of runs: nothing, as no registered body has this id. */
const LET_GO: MainThreadFunction = Object.freeze({ _wkltId: "" });

/**
 * What the engine holds for a main-thread event or a gesture's callback: it hands it back to
 * `runWorklet` on each call.
 */
export class Entry {
	/** The function it runs now. */
	fn: MainThreadFunction;
	/**
	 * What a gesture's callback gets as its second argument, from what the engine gives: the
	 * engine's own when this is not set.
	 */
	manager: ((engine: unknown) => unknown) | undefined;
	private made: Ready | undefined;
	private readonly scope: BindingScope;

	constructor(fn: MainThreadFunction, scope: BindingScope) {
		this.fn = fn;
		this.scope = scope;
	}

	/** The function, ready to call; `undefined` once the page is silenced or the entry let go. */
	ready(): Ready | undefined {
		if (this.scope.silenced() || this.fn === LET_GO) return undefined;
		return (this.made ??= prepare(this.fn, this.scope));
	}

	/** The event runs `fn` from now on. */
	swap(fn: MainThreadFunction): void {
		this.fn = fn;
		this.made = undefined;
	}

	/**
	 * The engine no longer has the entry for anything: it runs nothing from now on, and holds
	 * neither its function nor what made the second argument, in case the engine keeps it a while.
	 */
	letGo(): void {
		this.fn = LET_GO;
		this.made = undefined;
		this.manager = undefined;
	}
}

/** One `main-thread:` attribute of one element, and what it bound. */
export interface Binding {
	readonly element: LynxElement;
	readonly kind: BindingKind;
	/** The attribute's value now. */
	value: unknown;
	/** An event's entry. */
	entry?: Entry;
	/** The event's type and name. */
	event?: { type: LynxEventType; name: string };
	/** A ref's: the ref it holds the element in. */
	ref?: Ref;
	/** A function ref's: what it returned, when that is a function, to run when it goes. */
	cleanup?: () => void;
	/** Released: a function ref that waits to run does not, nor a gesture that waits to be set. */
	released?: boolean;
}

/** What the kinds reach of the page. */
export interface BindingScope extends RunScope {
	refs: Refs;
	elements: Elements;
	flattening: Flattening;
	/** Whether the page is silenced: its functions run no more. */
	silenced(): boolean;
	/** Settles the binding, with the value it has now, at the next settle step (`BindingKind.settle`). */
	queue(binding: Binding): void;
	/** Runs `run`, reporting what it throws. */
	guarded(run: () => void): void;
	/** A main-thread function runs, by its id: a development build watches for update loops. */
	ran(id: string): void;
	/** The page's gesture detectors. */
	gestures: GestureDetectors;
}

/** What the page does for `main-thread:gesture` (./gestures.ts). */
export interface GestureDetectors {
	/**
	 * At the settle step: the binding's detectors follow its value once every binding due now is
	 * known, so a relation may name a gesture set after it.
	 */
	due(binding: Binding): void;
	/** The binding goes: its detectors go, and its element keeps their ids. */
	release(binding: Binding): void;
	/** The element goes: the ids it kept are free. */
	forget(element: LynxElement): void;
}

/** What one kind of binding does. */
export interface BindingKind {
	/** The element takes a value of this kind. */
	bind(binding: Binding, scope: BindingScope): void;
	/** The value changes. */
	change(binding: Binding, value: unknown, scope: BindingScope): void;
	/**
	 * Hydration: the background's value takes the place of the first frame's, which already runs.
	 * What it changes is a change; what it does not, it takes over.
	 */
	carry(binding: Binding, value: unknown, scope: BindingScope): void;
	/** The attribute or its element goes. */
	release(binding: Binding, scope: BindingScope): void;
	/**
	 * The settle step, for a binding that queued itself: its element is in the tree, and the flush
	 * that shows it has not come. Each binding settles on its own: what one throws is reported, and
	 * the others settle.
	 */
	settle?(binding: Binding, scope: BindingScope): void;
}

/** Runs a function ref's cleanup, if it left one. */
function cleanUp(binding: Binding, scope: BindingScope): void {
	const { cleanup } = binding;
	binding.cleanup = undefined;
	if (cleanup) scope.guarded(cleanup);
}

/** A ref's value: a ref, or a main-thread function that gets the element. */
const refKind: BindingKind = {
	bind(binding, scope) {
		// Main-thread code drives the element: it gets a UI of its own, to be measured and animated.
		scope.flattening.hold(binding.element);
		const { value } = binding;
		if (isMainThreadFunction(value)) {
			scope.queue(binding);
			return;
		}
		if (!isRefHandle(value)) return;
		binding.ref = scope.refs.of(value);
		binding.ref.current = scope.elements.wrap(binding.element);
	},
	change(binding, value, scope) {
		if (isRefHandle(value) && binding.ref !== undefined && scope.refs.of(value) === binding.ref) {
			binding.value = value;
			return;
		}
		this.release(binding, scope);
		binding.released = false;
		binding.value = value;
		this.bind(binding, scope);
	},
	carry(binding, value, scope) {
		if (
			isMainThreadFunction(value) &&
			isMainThreadFunction(binding.value) &&
			sameFunction(value, binding.value)
		) {
			binding.value = value;
			return;
		}
		this.change(binding, value, scope);
	},
	settle(binding, scope) {
		// Boundary: a ref queues itself only with a main-thread function (`bind`).
		const fn = binding.value as MainThreadFunction;
		scope.ran(fn._wkltId);
		const returned = prepare(fn, scope)(scope.elements.wrap(binding.element));
		binding.cleanup = typeof returned === "function" ? (returned as () => void) : undefined;
	},
	release(binding, scope) {
		binding.released = true;
		const { ref } = binding;
		binding.ref = undefined;
		if (ref && ref.current === scope.elements.find(binding.element)) ref.current = null;
		cleanUp(binding, scope);
	},
};

/** An event's value: a main-thread function, which the event's entry runs. */
const eventKind: BindingKind = {
	bind(binding, scope) {
		const { value, event } = binding;
		if (!isMainThreadFunction(value) || !event) return;
		binding.entry = new Entry(value, scope);
		mainThread.__AddEvent(binding.element, event.type, event.name, {
			type: "worklet",
			value: binding.entry,
		});
	},
	change(binding, value, scope) {
		binding.value = value;
		if (!isMainThreadFunction(value)) {
			this.release(binding, scope);
			return;
		}
		if (binding.entry) binding.entry.swap(value);
		else this.bind(binding, scope);
	},
	carry(binding, value, scope) {
		this.change(binding, value, scope);
	},
	release(binding) {
		const { entry, event } = binding;
		binding.entry = undefined;
		if (entry && event) mainThread.__AddEvent(binding.element, event.type, event.name, undefined);
	},
};

/** A gesture's value: Lynx's detectors, set at the settle step. */
const gestureKind: BindingKind = {
	bind(binding, scope) {
		scope.queue(binding);
	},
	change(binding, value, scope) {
		binding.value = value;
		scope.queue(binding);
	},
	carry(binding, value, scope) {
		this.change(binding, value, scope);
	},
	settle(binding, scope) {
		scope.gestures.due(binding);
	},
	release(binding, scope) {
		binding.released = true;
		scope.gestures.release(binding);
	},
};

/** Where an attribute binds: its kind, and the key of its slot on the element. */
export interface Slot {
	kind: BindingKind;
	/** One slot holds one binding: the two spellings of one event share it. */
	key: string;
	event?: { type: LynxEventType; name: string };
}

const REF_SLOT: Slot = { kind: refKind, key: "ref" };
const GESTURE_SLOT: Slot = { kind: gestureKind, key: "gesture" };

/** The kind of each attribute name, read once. */
const slots = new Map<string, Slot | null>();

/**
 * Where a `main-thread:` attribute binds, by its name: `main-thread:ref`, `main-thread:gesture`, or
 * an event in either spelling (`main-thread:ontap`, or `main-thread:bindtap` as the first frame
 * writes it). `null` for any other name.
 */
export function slotOf(name: string): Slot | null {
	let slot = slots.get(name);
	if (slot !== undefined) return slot;
	const rest = name.slice(MAIN_THREAD_PREFIX.length);
	if (rest === "ref") slot = REF_SLOT;
	else if (rest === "gesture") slot = GESTURE_SLOT;
	else {
		const event = eventOf(name) ?? eventOf(removedEventSpelling(name)?.replacement ?? "");
		slot =
			event && event.mainThread
				? {
						kind: eventKind,
						key: `${event.type}:${event.name}`,
						event: { type: event.type, name: event.name },
					}
				: null;
	}
	slots.set(name, slot);
	return slot;
}

/** Whether two values are the same as far as what they capture goes: see `sameFunction`. */
function same(a: unknown, b: unknown, depth: number): boolean {
	if (a === b) return true;
	if (typeof a !== "object" || typeof b !== "object" || a === null || b === null || depth > 64)
		return Number.isNaN(a) && Number.isNaN(b);
	// Two refs at the same place are the same ref once hydration has paired them.
	if (isRefHandle(a) || isRefHandle(b)) return isRefHandle(a) && isRefHandle(b);
	if (isMainThreadFunction(a) || isMainThreadFunction(b))
		return isMainThreadFunction(a) && isMainThreadFunction(b) && sameFunction(a, b, depth + 1);
	if (Array.isArray(a) !== Array.isArray(b)) return false;
	const keys = Object.keys(a);
	if (keys.length !== Object.keys(b).length) return false;
	return keys.every((key) =>
		same((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key], depth + 1),
	);
}

/**
 * Whether two copies of a main-thread function are the same function: one body, and the same
 * captured values, where refs at the same place count as the same and the handles of background
 * functions are left out (the first frame's name none).
 */
export function sameFunction(a: MainThreadFunction, b: MainThreadFunction, depth = 0): boolean {
	return a._wkltId === b._wkltId && same(a._c ?? {}, b._c ?? {}, depth);
}
