// The copy of a top-level main-thread function's captured `$state`, on the background. The function
// is made again when what it read changes, inside a `$derived`, so a captured state object has to
// be read whole there, member by member: the copy does that, and is what the main thread gets.
//
// It follows `$state.snapshot` step by step, so the main thread gets what a snapshot gives on the
// web. Where the snapshot hands a value to `structuredClone` (a class instance, an object with no
// prototype, a built-in such as a `RegExp`), the copy does what `structuredClone` does with data,
// and keeps the value as it is where `structuredClone` would refuse it, as the snapshot does.

import { backgroundError } from "../catalogue.ts";
import type { BackgroundError } from "../catalogue.ts";
import { TreeNode } from "../renderer/node.ts";

/**
 * How deep a copy goes. A state object that holds itself is a new proxy at each level, so a value
 * met before never comes round: only a depth ends the copy, before the thread's stack does.
 */
const MAX_DEPTH = 1000;

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

/**
 * `value`, a captured value of a main-thread function, copied as `$state.snapshot` copies it, and
 * read through state proxies so that the `$derived` it runs in follows every member. Throws for a
 * value that holds itself or is too deep, and for an element of the background.
 *
 * The snapshot itself reads `EventTarget` for every value and calls `structuredClone`, which
 * Lynx's threads lack; a canary test fails once it runs without them.
 *
 * @workaround capture-copy kind=lynx-gap delete-when="Lynx's threads have EventTarget and structuredClone, or Svelte's $state.snapshot stops reading them, or the binding fills them in"
 */
export function copyCapture(value: unknown, source?: CaptureSource): unknown {
	return copy(value, { seen: new Map(), source }, 0, undefined);
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
		const record = value as Record<string, unknown>;
		const out: Record<string, unknown> = {};
		walk.seen.set(value, out);
		if (original !== undefined) walk.seen.set(original, out);
		for (const key of Object.keys(record)) out[key] = copy(record[key], walk, depth + 1, undefined);
		return out;
	}
	if (value instanceof Date) return new Date(value.getTime());
	const toJSON: unknown = (value as { toJSON?: unknown }).toJSON;
	if (typeof toJSON === "function") return copy(toJSON.call(value), walk, depth + 1, value);
	const cloned = clone(value, new Map(), walk, depth);
	return cloned === REFUSED ? value : cloned;
}

/** The error for a value that holds itself or is too deep. */
function tooDeep({ source }: Walk): BackgroundError {
	return backgroundError({
		code: "capture_too_deep",
		details: { name: source?.name, depth: MAX_DEPTH, where: source?.where },
	});
}

/** The error for an element of the background, which never crosses. */
function elementCaptured(node: TreeNode, { source }: Walk): BackgroundError {
	return backgroundError({
		code: "element_in_main_thread_function",
		details: { tag: node.tag ?? node.kind, name: source?.name, where: source?.where },
	});
}

/** The errors `structuredClone` makes again by their names; any other is an `Error`. */
const ERRORS: Record<string, ErrorConstructor> = {
	EvalError,
	RangeError,
	ReferenceError,
	SyntaxError,
	TypeError,
	URIError,
};

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
	if (ArrayBuffer.isView(value)) return (value as Uint8Array).slice();
	if (value instanceof Error) {
		const message = Object.getOwnPropertyDescriptor(value, "message");
		const Make = ERRORS[value.name] ?? Error;
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
export function elementIn(value: unknown): TreeNode | undefined {
	return findElement(value, new Set(), 0);
}

function findElement(value: unknown, seen: Set<object>, depth: number): TreeNode | undefined {
	if (typeof value !== "object" || value === null || depth >= MAX_DEPTH || seen.has(value))
		return undefined;
	if (value instanceof TreeNode) return value;
	seen.add(value);
	const record = value as Record<string, unknown>;
	for (const key of Object.keys(record)) {
		const found = findElement(record[key], seen, depth + 1);
		if (found !== undefined) return found;
	}
	return undefined;
}
