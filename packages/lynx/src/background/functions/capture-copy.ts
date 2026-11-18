// The copy of a top-level main-thread function's captured `$state`, on the background. The function
// is made again when what it read changes, inside a `$derived`, so a captured state object has to
// be read whole there, member by member: the copy does that, and is what the main thread gets.
//
// It follows `$state.snapshot` step by step, so the main thread gets what a snapshot gives on the
// web. Where the snapshot hands a value to `structuredClone` (a class instance, an object with no
// prototype, a built-in such as a `RegExp`), the copy does what `structuredClone` does with data,
// and keeps the value as it is where `structuredClone` would refuse it, as the snapshot does.

import { backgroundError } from "../catalogue.ts";
import type { BackgroundError, BackgroundReport } from "../catalogue.ts";
import { TreeNode } from "../renderer/node.ts";

/**
 * How deep a copy goes. A state object that holds itself is a new proxy at each level, so a value
 * met before never comes round: only a depth ends the copy, before the thread's stack does. A Lynx
 * thread's stack is 1 MB, which about 900 levels of the copy fill on PrimJS; 500 leaves room for
 * the frames below the copy.
 */
const MAX_DEPTH = 500;

/** What a development build tells the copy of a capture, for its errors. */
export interface CaptureSource {
	/** The captured value, as the function reads it: `items`, `settings.size`. */
	name: string;
	/** The function's `file:line:col`. */
	where: string;
}

/** What one copy carries along. */
interface Walk {
	/** The copies of the arrays and plain objects copied so far, as the snapshot keeps them. */
	seen: Map<object, unknown>;
	source: CaptureSource | undefined;
}

/** What `structuredClone` would refuse: the value is then kept as it is. */
const REFUSED: object = {};

/** Why a capture could not be copied. */
type CaptureReport =
	| BackgroundReport<"capture_too_deep">
	| BackgroundReport<"element_in_main_thread_function">;

/** The reports of the errors the copy made, by error. */
const REPORTS = new WeakMap<Error, CaptureReport>();

/** The attribute a main-thread function is bound to, and its element's tag. */
export interface Bound {
	attribute: string;
	owner: string;
}

/**
 * `value`, a captured value of a main-thread function, copied as `$state.snapshot` copies it, and
 * read through state proxies so that the `$derived` it runs in follows every member. Never throws:
 * a value that holds itself or is too deep, an element of the background, or a read that throws
 * gives `unsent(error)` instead.
 *
 * The snapshot itself reads `EventTarget` for every value and hands most values to
 * `structuredClone`, one by one, which Lynx's engine lacks; and a state object that holds itself
 * overflows its stack. A canary test fails once it runs without the two globals.
 *
 * @workaround capture-copy kind=lynx-gap delete-when="Svelte's $state.snapshot copies without EventTarget or structuredClone, and stops at a depth a Lynx thread's stack holds"
 */
export function copyCapture(value: unknown, source?: CaptureSource): unknown {
	try {
		return copy(value, { seen: new Map(), source }, 0, undefined);
	} catch (error) {
		return unsent(error);
	}
}

/**
 * What a capture that could not be copied is sent as: writing it as text throws `error`, so the
 * channel does not send the function, and reports why; the function sent before stays. Thrown
 * into the `$derived` the function is made in, the error would stop the page's updates.
 */
function unsent(error: unknown): object {
	return {
		toJSON(): never {
			throw error;
		},
	};
}

/**
 * Why a main-thread function bound to `bound.attribute` cannot be sent, in the developer's words:
 * a capture of it that could not be copied, from `error`, which writing it as text threw, or an
 * element of the background it holds. `undefined` for any other reason.
 */
export function unsentFunctionError(
	value: unknown,
	error: unknown,
	bound: Bound,
): BackgroundError | undefined {
	const report = error instanceof Error ? REPORTS.get(error) : undefined;
	if (report !== undefined)
		return backgroundError({ ...report, details: { ...report.details, ...bound } });
	const element = findElement(value, new Set(), 0);
	if (element === undefined) return undefined;
	return backgroundError({
		code: "element_in_main_thread_function",
		details: { tag: element.tag ?? element.kind, ...bound },
	});
}

/** The error of `report`, which the channel reports again with the attribute it is bound to. */
function captureError(report: CaptureReport): BackgroundError {
	const error = backgroundError(report);
	REPORTS.set(error, report);
	return error;
}

/** `value` as `$state.snapshot` copies it; `original` is what `value` came from by its `toJSON`. */
function copy(value: unknown, walk: Walk, depth: number, original: object | undefined): unknown {
	if (typeof value !== "object" || value === null) return value;
	const known = walk.seen.get(value);
	if (known !== undefined) return known;
	if (depth >= MAX_DEPTH) throw tooDeep(walk);
	if (value instanceof Map) return new Map(value);
	if (value instanceof Set) return new Set(value);
	if (Array.isArray(value)) {
		const items: unknown[] = value;
		// The length first: a hole stays a hole.
		const out: unknown[] = [];
		out.length = items.length;
		walk.seen.set(value, out);
		if (original !== undefined) walk.seen.set(original, out);
		for (let index = 0; index < items.length; index++) {
			const item = items[index];
			if (index in items) out[index] = copy(item, walk, depth + 1, undefined);
		}
		return out;
	}
	if (Object.getPrototypeOf(value) === Object.prototype) {
		// Boundary: a plain object, read by its own keys.
		const record = value as Record<string, unknown>;
		const out: Record<string, unknown> = {};
		walk.seen.set(value, out);
		if (original !== undefined) walk.seen.set(original, out);
		for (const key of Object.keys(record)) out[key] = copy(record[key], walk, depth + 1, undefined);
		return out;
	}
	if (value instanceof Date) return new Date(value.getTime());
	// Boundary: any object may have a `toJSON`, as `JSON.stringify` reads it.
	const toJSON: unknown = (value as { toJSON?: unknown }).toJSON;
	if (typeof toJSON === "function") return copy(toJSON.call(value), walk, depth + 1, value);
	const cloned = clone(value, new Map(), walk, depth);
	return cloned === REFUSED ? value : cloned;
}

/** The error for a value that holds itself or is too deep. */
function tooDeep({ source }: Walk): BackgroundError {
	return captureError({
		code: "capture_too_deep",
		details: { name: source?.name, depth: MAX_DEPTH, where: source?.where },
	});
}

/** The error for an element of the background, which never crosses. */
function elementCaptured(node: TreeNode, { source }: Walk): BackgroundError {
	return captureError({
		code: "element_in_main_thread_function",
		details: { tag: node.tag ?? node.kind, name: source?.name, where: source?.where },
	});
}

/** The errors `structuredClone` makes again by their names; any other is an `Error`. */
const ERRORS = new Map<string, ErrorConstructor>([
	["EvalError", EvalError],
	["RangeError", RangeError],
	["ReferenceError", ReferenceError],
	["SyntaxError", SyntaxError],
	["TypeError", TypeError],
	["URIError", URIError],
]);

/**
 * `value` as `structuredClone` copies data, reading the built-ins' own data as it does, or
 * `REFUSED`. A state proxy is a plain object or an array to every check but Svelte's own, and
 * `structuredClone` refuses it, so a plain object or an array met here is refused: it may be one.
 */
function clone(value: unknown, seen: Map<object, unknown>, walk: Walk, depth: number): unknown {
	if (typeof value === "function" || typeof value === "symbol") return REFUSED;
	if (typeof value !== "object" || value === null) return value;
	const known = seen.get(value);
	if (known !== undefined) return known;
	if (depth >= MAX_DEPTH) throw tooDeep(walk);
	const prototype: unknown = Object.getPrototypeOf(value);
	if (prototype === Object.prototype || prototype === Array.prototype) return REFUSED;
	if (value instanceof TreeNode) throw elementCaptured(value, walk);
	if (value instanceof WeakMap || value instanceof WeakSet || value instanceof Promise)
		return REFUSED;
	if (value instanceof Date) return new Date(Date.prototype.getTime.call(value));
	if (value instanceof RegExp) return new RegExp(value.source, value.flags);
	if (value instanceof Boolean) return new Boolean(Boolean.prototype.valueOf.call(value));
	if (value instanceof Number) return new Number(Number.prototype.valueOf.call(value));
	if (value instanceof String) return new String(String.prototype.valueOf.call(value));
	if (value instanceof ArrayBuffer) return value.slice(0);
	if (value instanceof DataView)
		return new DataView(value.buffer.slice(0), value.byteOffset, value.byteLength);
	// Boundary: every typed array has `slice`; only a `DataView` lacks it, and it is copied above.
	if (ArrayBuffer.isView(value)) return (value as Uint8Array).slice();
	if (value instanceof Error) {
		const message = Object.getOwnPropertyDescriptor(value, "message");
		const Make = ERRORS.get(value.name) ?? Error;
		return message && "value" in message ? new Make(String(message.value)) : new Make();
	}
	if (value instanceof Map) {
		const out = new Map<unknown, unknown>();
		seen.set(value, out);
		for (const [key, item] of Map.prototype.entries.call(value)) {
			const keyCopy = clone(key, seen, walk, depth + 1);
			const itemCopy = clone(item, seen, walk, depth + 1);
			if (keyCopy === REFUSED || itemCopy === REFUSED) return REFUSED;
			out.set(keyCopy, itemCopy);
		}
		return out;
	}
	if (value instanceof Set) {
		const out = new Set<unknown>();
		seen.set(value, out);
		for (const item of Set.prototype.values.call(value)) {
			const itemCopy = clone(item, seen, walk, depth + 1);
			if (itemCopy === REFUSED) return REFUSED;
			out.add(itemCopy);
		}
		return out;
	}
	// An array of a subclass, or any other object: its own enumerable data.
	// Boundary: any object, read by its own keys.
	const record = value as Record<string, unknown>;
	let out: Record<string, unknown> = {};
	if (Array.isArray(value)) {
		const items: unknown[] = [];
		items.length = value.length;
		// Boundary: an array's members are written by their keys too, as `structuredClone` writes them.
		out = items as unknown as Record<string, unknown>;
	}
	seen.set(value, out);
	for (const key of Object.keys(record)) {
		const item = clone(record[key], seen, walk, depth + 1);
		if (item === REFUSED) return REFUSED;
		out[key] = item;
	}
	return out;
}

/**
 * The first element of the background in `value`, at any depth: a main-thread function that could
 * not be sent may have captured one, from state the copy does not read.
 */
function findElement(value: unknown, seen: Set<object>, depth: number): TreeNode | undefined {
	if (typeof value !== "object" || value === null || depth >= MAX_DEPTH || seen.has(value))
		return undefined;
	if (value instanceof TreeNode) return value;
	seen.add(value);
	// Boundary: any object, read by its own keys.
	const record = value as Record<string, unknown>;
	for (const key of Object.keys(record)) {
		const found = findElement(record[key], seen, depth + 1);
		if (found !== undefined) return found;
	}
	return undefined;
}
