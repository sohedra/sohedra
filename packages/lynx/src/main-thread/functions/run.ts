// Running a main-thread function: its registered body, called with a copy of its object as `this`,
// in which what it captured is what the body reads. A handle of a ref is the page's ref, an element
// is its wrapper, a main-thread function is a function to call, and a handle of a background
// function stays the handle, for `runOnBackground`. The object as it came is left as it is:
// hydration reads it again.
//
// The engine's own calls hand an event (`source` 1) or a gesture's event and its manager (`source`
// 2). Their two targets carry the element itself (`elementRefptr`), which becomes its wrapper; an
// event also gets `stopPropagation` and `stopImmediatePropagation`, whose bits the engine reads
// from what the call returns.

import {
	FUNCTION_FIELDS,
	HANDLE_FIELDS,
	isBackgroundHandle,
	isMainThreadFunction,
	isRefHandle,
	RUN_SOURCE,
} from "../../wire/index.ts";
import type { MainThreadFunction } from "../../wire/index.ts";
import { mainThreadError } from "../catalogue.ts";
import { functionsGlobal } from "../globals.ts";
import type { LynxElement } from "../globals.ts";
import { MainThreadElement } from "./element.ts";
import type { Elements } from "./element.ts";
import type { Lifetimes } from "./lifetimes.ts";
import { Ref } from "./refs.ts";
import type { Refs } from "./refs.ts";

/** A main-thread function, ready to call. */
export type Ready = (...args: unknown[]) => unknown;

/** What a function's captures are made into, on one page. */
export interface RunScope {
	refs: Refs;
	elements: Elements;
}

/** How deep a value is walked; deeper, its captures are refused. */
const MAX_DEPTH = 1000;

/** The engine's `EventResult` bits, which it reads from what an event's function returns. */
const STOP_PROPAGATION = 1;
const STOP_IMMEDIATE_PROPAGATION = 2;

/** The main-thread function `fn`, ready to call, with its captures made what its body reads. */
export function prepare(fn: MainThreadFunction, scope: RunScope): Ready {
	const id = fn[FUNCTION_FIELDS.id];
	const body = functionsGlobal().bodies[id];
	if (body === undefined)
		throw mainThreadError({ code: "main_thread_function_not_found", details: { id } });
	const self: Record<string, unknown> = { ...fn };
	const captures = fn[FUNCTION_FIELDS.captures];
	if (captures !== undefined) self[FUNCTION_FIELDS.captures] = made(captures, scope, 0);
	return body.bind(self) as Ready;
}

/**
 * `value` as a body reads it: refs, elements and functions made, the rest as it is. A copy only
 * where something in it is made.
 */
export function made(value: unknown, scope: RunScope, depth: number): unknown {
	if (typeof value !== "object" || value === null) return value;
	if (depth > MAX_DEPTH)
		throw mainThreadError({ code: "main_thread_value_too_deep", details: { depth: MAX_DEPTH } });
	if (value instanceof MainThreadElement || value instanceof Ref) return value;
	const element: unknown = Reflect.get(value, "elementRefptr");
	if (element !== undefined && element !== null) return scope.elements.wrap(element as LynxElement);
	if (isRefHandle(value)) return scope.refs.of(value);
	if (isMainThreadFunction(value)) return prepare(value, scope);
	if (isBackgroundHandle(value)) return value;
	if (Array.isArray(value)) {
		let copy: unknown[] | undefined;
		for (let index = 0; index < value.length; index++) {
			const item: unknown = value[index];
			const next = made(item, scope, depth + 1);
			if (next !== item) (copy ??= value.slice())[index] = next;
		}
		return copy ?? value;
	}
	const record = value as Record<string, unknown>;
	let copy: Record<string, unknown> | undefined;
	for (const key of Object.keys(record)) {
		const item = record[key];
		const next = made(item, scope, depth + 1);
		if (next !== item) (copy ??= { ...record })[key] = next;
	}
	return copy ?? value;
}

/**
 * The main thread takes `value` (an attribute's, a call's function or arguments): each copy of a
 * main-thread function in it that came with a context, and each handle in that copy, is held for
 * the context. A handle learns its context here. A function sent without one costs one look.
 */
export function holdValue(value: unknown, lifetimes: Lifetimes): void {
	hold(value, lifetimes, undefined, 0);
}

function hold(
	value: unknown,
	lifetimes: Lifetimes,
	context: number | undefined,
	depth: number,
): void {
	if (typeof value !== "object" || value === null || depth > MAX_DEPTH) return;
	if (value instanceof MainThreadElement || value instanceof Ref) return;
	if (isMainThreadFunction(value)) {
		const own = value[FUNCTION_FIELDS.context];
		// Sent without one, nothing in it calls the background: the background gives a context to
		// every function that reaches one.
		const id = own ?? context;
		if (id === undefined) return;
		if (own !== undefined) lifetimes.hold(own, value);
		hold(value[FUNCTION_FIELDS.background], lifetimes, id, depth + 1);
		hold(value[FUNCTION_FIELDS.captures], lifetimes, id, depth + 1);
		return;
	}
	if (context !== undefined && isBackgroundHandle(value)) {
		if (value[HANDLE_FIELDS.id] === undefined) return;
		value[HANDLE_FIELDS.context] = context;
		lifetimes.hold(context, value);
		return;
	}
	for (const key of Object.keys(value))
		hold((value as Record<string, unknown>)[key], lifetimes, context, depth + 1);
}

/** An event or a gesture's event, with its targets' elements made wrappers. */
function withTargets(event: unknown, elements: Elements): unknown {
	if (typeof event !== "object" || event === null) return event;
	const record = event as Record<string, unknown>;
	for (const key of ["target", "currentTarget"]) {
		const target = record[key];
		if (typeof target !== "object" || target === null) continue;
		const element: unknown = Reflect.get(target, "elementRefptr");
		if (element !== undefined && element !== null)
			record[key] = elements.wrap(element as LynxElement);
	}
	return record;
}

// `stopPropagation` and `stopImmediatePropagation`: one pair for every event, which marks the
// event that is running, called on it or taken off it.
let running: object | undefined;
let stopped = 0;

function stopPropagation(this: unknown): void {
	if (this === running || this === undefined) stopped |= STOP_PROPAGATION;
}

function stopImmediatePropagation(this: unknown): void {
	if (this === running || this === undefined) stopped |= STOP_IMMEDIATE_PROPAGATION;
}

/**
 * Runs `ready` as the engine asks: `params` are an event's (`source` 1) or a gesture's (`source`
 * 2), as the engine gave them, or a call's, already made.
 */
export function runAs(
	ready: Ready,
	call: { params: unknown[]; source: number | undefined; elements: Elements },
): unknown {
	const { params, source, elements } = call;
	if (source === RUN_SOURCE.gesture) return ready(withTargets(params[0], elements), params[1]);
	if (source !== RUN_SOURCE.event) return ready(...params);
	const event = withTargets(params[0], elements);
	if (typeof event !== "object" || event === null) return ready(event);
	const record = event as Record<string, unknown>;
	record["stopPropagation"] = stopPropagation;
	record["stopImmediatePropagation"] = stopImmediatePropagation;
	const outer = { running, stopped };
	running = event;
	stopped = 0;
	try {
		const returnValue = ready(event);
		return { returnValue, eventReturnResult: stopped };
	} finally {
		running = outer.running;
		stopped = outer.stopped;
	}
}
