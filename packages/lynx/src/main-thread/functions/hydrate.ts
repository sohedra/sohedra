// Main-thread functions at hydration: the background's copy of each function takes over from the
// first frame's on the same element, with what the first frame's left. Hydration's pairs of
// elements decide which copies meet, and a walk over each pair of values decides the rest: a ref
// the first frame's function made is the background's ref of the same place from now on, and a
// handle of a background function the first frame's function holds names the background's
// function of the same place, for the calls it made and will make. Every pair is carried before
// any is bound, so a ref is made once.
//
// The walk is ReactLynx's (its worklet runtime's hydration; see NOTICE), over the values as they
// came: a function the first frame ran made its captures from them, and left them as they were.

import {
	FUNCTION_FIELDS,
	HANDLE_FIELDS,
	isMainThreadFunction,
	isRefHandle,
	REF_FIELDS,
} from "../../wire/index.ts";
import type { BackgroundFunctionHandle } from "../../wire/index.ts";
import type { Lifetimes } from "./lifetimes.ts";
import type { Refs } from "./refs.ts";

/** How deep the walk goes. */
const MAX_DEPTH = 64;

/** What a walk carries into. */
export interface CarryScope {
	refs: Refs;
	lifetimes: Lifetimes;
}

/**
 * Carries what the first frame's value `drawn` left into the background's `value`, which takes its
 * place: refs, and handles of background functions. `context` is the background's context of the
 * function the walk is in.
 */
export function carry(
	value: unknown,
	drawn: unknown,
	scope: CarryScope,
	context?: number,
	depth = 0,
): void {
	if (typeof value !== "object" || value === null) return;
	if (typeof drawn !== "object" || drawn === null || depth > MAX_DEPTH) return;
	if (isRefHandle(value)) {
		if (isRefHandle(drawn)) scope.refs.alias(value[REF_FIELDS.id], drawn[REF_FIELDS.id]);
		return;
	}
	if (isMainThreadFunction(value)) {
		if (!isMainThreadFunction(drawn) || drawn[FUNCTION_FIELDS.id] !== value[FUNCTION_FIELDS.id])
			return;
		const own = value[FUNCTION_FIELDS.context] ?? context;
		carryHandles(value[FUNCTION_FIELDS.background], drawn[FUNCTION_FIELDS.background], {
			scope,
			context: own,
		});
		carry(value[FUNCTION_FIELDS.captures], drawn[FUNCTION_FIELDS.captures], scope, own, depth + 1);
		return;
	}
	const from = drawn as Record<string, unknown>;
	for (const key of Object.keys(value))
		carry((value as Record<string, unknown>)[key], from[key], scope, context, depth + 1);
}

/**
 * The first frame's handles name the background's functions of the same names, in the
 * background's context, which the main thread now holds for them: a first-frame closure may still
 * call through one.
 */
function carryHandles(
	handles: Record<string, BackgroundFunctionHandle> | undefined,
	drawn: Record<string, BackgroundFunctionHandle> | undefined,
	{ scope, context }: { scope: CarryScope; context: number | undefined },
): void {
	if (!handles || !drawn || context === undefined) return;
	for (const name of Object.keys(handles)) {
		const handle = handles[name];
		const first = drawn[name];
		const id = handle?.[HANDLE_FIELDS.id];
		if (!first || id === undefined || first[HANDLE_FIELDS.id] !== undefined) continue;
		first[HANDLE_FIELDS.id] = id;
		first[HANDLE_FIELDS.context] = context;
		delete first[HANDLE_FIELDS.firstFrame];
		scope.lifetimes.hold(context, first);
	}
}
