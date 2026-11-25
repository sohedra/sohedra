// Main-thread refs on the background: the handle main-thread functions capture and
// `main-thread:ref` takes. Its value lives on the main thread, which makes the ref from the
// handle's initial value the first time it sees the handle's id, and forgets it when the page lets
// go of the handle: the ids of collected handles ride in the next patch the page sends, as an
// `unref` call. Nothing is scheduled for them: the collector runs when it likes.

import { REF_FIELDS } from "../../wire/index.ts";
import type { MainThreadRefHandle } from "../../wire/index.ts";
import { backgroundError } from "../catalogue.ts";
import { DEV, finalizationRegistry } from "../globals.ts";
import { warnOnce } from "../report.ts";

declare const brand: unique symbol;

/**
 * A value the main thread owns, which main-thread functions share: an element (with
 * `main-thread:ref`) or any state. Read and write `current` inside main-thread functions; on the
 * background it is the initial value, and setting it throws.
 */
export interface MainThreadRef<T> {
	current: T;
	/** Marks the type: a ref is made by `mainThreadRef` only. */
	readonly [brand]: T;
}

let collected: number[] = [];
let nextRef = 1;
let registry: FinalizationRegistry<number> | undefined | null = null;

function onCollected(id: number): void {
	collected.push(id);
}

/** The ids of the refs collected since, which the next patch tells the main thread of. */
export function takeCollectedRefs(): number[] {
	if (collected.length === 0) return collected;
	const ids = collected;
	collected = [];
	return ids;
}

/** A main-thread ref's handle, as the background holds it. */
class RefHandle<T> {
	declare readonly [REF_FIELDS.id]: number;
	declare readonly [REF_FIELDS.initial]: T;

	constructor(initial: T) {
		// Boundary: the fields are the handle's, set once here.
		(this as { [REF_FIELDS.id]: number })[REF_FIELDS.id] = nextRef++;
		(this as { [REF_FIELDS.initial]: T })[REF_FIELDS.initial] = initial;
		// Made with the first ref: `undefined` when the engine has none, `null` until then.
		if (registry === null) registry = finalizationRegistry(onCollected);
		registry?.register(this, this[REF_FIELDS.id]);
	}

	get current(): T {
		if (DEV)
			warnOnce("main_thread_ref_read_on_background", () => ({
				code: "main_thread_ref_read_on_background",
				details: {},
			}));
		return this[REF_FIELDS.initial];
	}

	set current(_value: T) {
		throw backgroundError({ code: "main_thread_ref_set_on_background", details: {} });
	}

	/** The handle as it crosses: its id and its initial value. */
	toJSON(): MainThreadRefHandle {
		return { [REF_FIELDS.id]: this[REF_FIELDS.id], [REF_FIELDS.initial]: this[REF_FIELDS.initial] };
	}
}

/**
 * Makes a main-thread ref that starts as `initial`, for an element (`main-thread:ref`) or state
 * that main-thread functions share. The main thread makes its value the first time a main-thread
 * function or an element uses it, and forgets it once the page lets go of the ref; a ref made at a
 * module's top level starts again from `initial` on a page that reloads.
 */
export function mainThreadRef<T>(initial: T): MainThreadRef<T>;
/** Makes a main-thread ref that starts as `undefined`: see the first overload. */
export function mainThreadRef<T = undefined>(): MainThreadRef<T | undefined>;
export function mainThreadRef<T>(initial?: T): MainThreadRef<T | undefined> {
	// Boundary: the handle is the ref; its type hides how it crosses.
	return new RefHandle(initial) as unknown as MainThreadRef<T | undefined>;
}
