// The contexts of main-thread functions: what lets a main-thread function call the background
// functions it holds handles to (`runOnBackground(fn)`). A function that reaches one, itself or
// through a main-thread function it captured, gets a context each time it is sent: a copy of it
// with a new id (`_execId`), which the main thread names in its call, and which is kept here until
// the main thread lets go of every copy it holds (a release message). A function that reaches none
// gets none, and costs nothing here.
//
// A context is given where a value becomes the text that crosses (the channel's `encode` and
// `flush`, a call's request): what is never sent never holds one. Ids are never given twice.

import { FUNCTION_FIELDS, HANDLE_FIELDS, isMainThreadFunction } from "../../wire/index.ts";
import type { MainThreadFunction } from "../../wire/index.ts";

/** A background function, as a handle holds it. */
type BackgroundFunction = (...args: unknown[]) => unknown;

/** How deep the walks go: a value deeper than this is not walked further. */
const MAX_DEPTH = 64;

/** The contexts of one page's main-thread functions. */
export interface Contexts {
	/**
	 * `value` as it is sent: each main-thread function in it that reaches a background function is
	 * a copy with a new context, whose id is added to `given`. What has none is sent as it is.
	 */
	send(value: unknown, given: number[]): unknown;
	/** The background function `fn` that the context `context` holds a handle to, if it is kept. */
	find(context: number, fn: number): BackgroundFunction | undefined;
	/** The main thread let go of every copy of these contexts. */
	release(ids: readonly number[]): void;
	/** Lets go of every context but those in `kept`. */
	keepOnly(kept: ReadonlySet<number>): void;
	/** Lets go of every context. */
	clear(): void;
	/** The ids of the contexts kept. */
	ids(): number[];
}

/** A class instance as it is sent: what its `toJSON` gives, as `JSON.stringify` would. */
function asSent(value: object): unknown {
	const toJSON: unknown = Reflect.get(value, "toJSON");
	return typeof toJSON === "function" ? toJSON.call(value) : value;
}

/** Whether a main-thread function reaches a background function, itself or through its captures. */
const reachCache = new WeakMap<object, boolean>();

function reaches(fn: MainThreadFunction): boolean {
	const known = reachCache.get(fn);
	if (known !== undefined) return known;
	const handles = fn[FUNCTION_FIELDS.background];
	const found =
		(handles !== undefined && Object.keys(handles).length > 0) ||
		holdsReaching(fn[FUNCTION_FIELDS.captures], 0);
	reachCache.set(fn, found);
	return found;
}

/** Whether `value` holds a main-thread function that reaches a background function. */
function holdsReaching(value: unknown, depth: number): boolean {
	if (typeof value !== "object" || value === null || depth > MAX_DEPTH) return false;
	const sent = asSent(value);
	if (typeof sent !== "object" || sent === null) return false;
	if (isMainThreadFunction(sent)) return reaches(sent);
	for (const key of Object.keys(sent))
		if (holdsReaching((sent as Record<string, unknown>)[key], depth + 1)) return true;
	return false;
}

/** The handle with id `fn` in `value`, at any depth. */
function findHandle(value: unknown, fn: number, depth: number): BackgroundFunction | undefined {
	if (typeof value !== "object" || value === null || depth > MAX_DEPTH) return undefined;
	const sent = asSent(value);
	if (typeof sent !== "object" || sent === null) return undefined;
	const record = sent as Record<string, unknown>;
	if (record[HANDLE_FIELDS.id] === fn) {
		const found = record["_fn"];
		return typeof found === "function" ? (found as BackgroundFunction) : undefined;
	}
	for (const key of Object.keys(record)) {
		const found = findHandle(record[key], fn, depth + 1);
		if (found) return found;
	}
	return undefined;
}

let nextContext = 1;

/** The contexts of one page. */
export function createContexts(): Contexts {
	const kept = new Map<number, MainThreadFunction>();

	function send(value: unknown, given: number[], depth: number): unknown {
		if (typeof value !== "object" || value === null || depth > MAX_DEPTH) return value;
		const sent = asSent(value);
		if (typeof sent !== "object" || sent === null) return sent;
		if (isMainThreadFunction(sent)) {
			if (!reaches(sent)) return sent;
			const id = nextContext++;
			const copy: MainThreadFunction = { ...sent, [FUNCTION_FIELDS.context]: id };
			kept.set(id, copy);
			given.push(id);
			return copy;
		}
		// A copy only where something in it changed: the rest is sent as it is.
		if (Array.isArray(sent)) {
			let copy: unknown[] | undefined;
			for (let index = 0; index < sent.length; index++) {
				const item: unknown = sent[index];
				const next = send(item, given, depth + 1);
				if (next !== item) (copy ??= sent.slice())[index] = next;
			}
			return copy ?? sent;
		}
		let copy: Record<string, unknown> | undefined;
		const record = sent as Record<string, unknown>;
		for (const key of Object.keys(record)) {
			const item = record[key];
			const next = send(item, given, depth + 1);
			if (next !== item) (copy ??= { ...record })[key] = next;
		}
		return copy ?? sent;
	}

	return {
		send: (value, given) => send(value, given, 0),
		find(context, fn) {
			const copy = kept.get(context);
			return copy && findHandle(copy, fn, 0);
		},
		release(ids) {
			for (const id of ids) kept.delete(id);
		},
		keepOnly(ids) {
			for (const id of kept.keys()) if (!ids.has(id)) kept.delete(id);
		},
		clear() {
			kept.clear();
		},
		ids: () => [...kept.keys()],
	};
}
