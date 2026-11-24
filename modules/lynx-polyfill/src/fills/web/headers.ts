// `Headers`: the Fetch Standard § 5.2 "Headers class" over § 2.2.2's header list. lynx-core's (an
// mswjs headers-polyfill, modules/fetch/Headers.ts) names headers by their case, combines no
// duplicates on read, and has no `getSetCookie`; the fetch fill (fetch.ts) replaces it with this.
// Leaves out the guards no runtime without a browser's security model uses ("request",
// "request-no-cors", "response"): a header list is either changeable or immutable.

import { named } from "../install.ts";
import type { HeadersClass } from "./standard-classes.ts";

/** HTTP's `token`: a header's name, a method. */
export const TOKEN: RegExp = /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/;

/** HTTP whitespace at either end of a value, which a value loses (§ 2.2 "normalize"). */
const EDGE_WHITESPACE = /^[\t\n\r ]+|[\t\n\r ]+$/g;

/** What a value may not hold: NUL, CR, LF, or a character outside a byte (WebIDL `ByteString`). */
const NOT_A_VALUE = /[\0\r\nĀ-￿]/;

/** A header list: its names in lowercase (they compare so), values in the order they came. */
interface HeaderState {
	list: [name: string, value: string][];
	immutable: boolean;
}

/** The Fetch Standard's `Headers`, and how to make one immutable, as a fetched response's are. */
export function createHeaders(): { Headers: HeadersClass; freeze: (headers: Headers) => Headers } {
	const states = new WeakMap<object, HeaderState>();
	const stateOf = (headers: unknown): HeaderState => {
		const state = typeof headers === "object" && headers !== null ? states.get(headers) : undefined;
		if (!state) throw new TypeError("Illegal invocation: not a Headers.");
		return state;
	};
	const changeable = (headers: unknown): HeaderState => {
		const state = stateOf(headers);
		if (state.immutable)
			throw new TypeError("These headers can't be changed: they are a response's.");
		return state;
	};

	class HeadersFill {
		constructor(init?: HeadersInit) {
			states.set(this, { list: [], immutable: false });
			if (init === undefined) return;
			if (typeof init !== "object" || init === null)
				throw new TypeError("Headers takes a record, a list of pairs or another Headers.");
			// Web IDL's union of a sequence and a record: its iterator read once, as GetMethod does.
			// Boundary: an object of the app's, read by name.
			const method = (init as { [Symbol.iterator]?: unknown })[Symbol.iterator];
			if (method !== undefined && method !== null) {
				if (typeof method !== "function")
					throw new TypeError("Headers takes a record, a list of pairs or another Headers.");
				const pairs: [string, string][] = [];
				for (const pair of { [Symbol.iterator]: () => method.call(init) } as Iterable<unknown>) {
					// Boundary: a pair of the list, which the standard checks.
					const entry = [...(pair as Iterable<unknown>)];
					if (entry.length !== 2) throw new TypeError("Headers takes pairs of a name and a value.");
					pairs.push([`${entry[0] as string}`, `${entry[1] as string}`]);
				}
				for (const [name, value] of pairs) this.append(name, value);
				return;
			}
			for (const [name, value] of recordOf(init)) this.append(name, value);
		}

		append(name: string, value: string): void {
			const state = changeable(this);
			state.list.push([checkName(name), checkValue(value)]);
		}

		delete(name: string): void {
			const state = changeable(this);
			const key = checkName(name);
			state.list = state.list.filter(([each]) => each !== key);
		}

		get(name: string): string | null {
			const key = checkName(name);
			const values = stateOf(this)
				.list.filter(([each]) => each === key)
				.map(([, value]) => value);
			return values.length === 0 ? null : values.join(", ");
		}

		getSetCookie(): string[] {
			return stateOf(this)
				.list.filter(([name]) => name === "set-cookie")
				.map(([, value]) => value);
		}

		has(name: string): boolean {
			const key = checkName(name);
			return stateOf(this).list.some(([each]) => each === key);
		}

		set(name: string, value: string): void {
			const state = changeable(this);
			const key = checkName(name);
			const normalized = checkValue(value);
			const at = state.list.findIndex(([each]) => each === key);
			if (at === -1) {
				state.list.push([key, normalized]);
				return;
			}
			state.list[at] = [key, normalized];
			state.list = state.list.filter(([each], index) => index <= at || each !== key);
		}

		forEach(
			callback: (value: string, name: string, parent: Headers) => void,
			thisArg?: unknown,
		): void {
			if (typeof callback !== "function") throw new TypeError("Headers.forEach takes a function.");
			// Boundary: the class itself, as TypeScript's DOM library types it.
			for (const [name, value] of sorted(stateOf(this)))
				callback.call(thisArg, value, name, this as unknown as Headers);
		}

		entries(): IterableIterator<[string, string]> {
			return headersIterator(stateOf(this), "entries");
		}

		keys(): IterableIterator<string> {
			return headersIterator(stateOf(this), "keys");
		}

		values(): IterableIterator<string> {
			return headersIterator(stateOf(this), "values");
		}

		[Symbol.iterator](): IterableIterator<[string, string]> {
			return this.entries();
		}
	}

	return {
		// Boundary: the class above, as TypeScript's DOM library types it.
		Headers: named(HeadersFill, "Headers") as unknown as HeadersClass,
		freeze: (headers) => {
			stateOf(headers).immutable = true;
			return headers;
		},
	};
}

/**
 * Web IDL § 3.2.20's conversion to `record<ByteString, ByteString>`: each own key in order, its
 * descriptor, and only an enumerable one's value; a symbol key is refused, as no ByteString.
 */
function recordOf(init: object): [string, string][] {
	const record: [string, string][] = [];
	// oxlint-disable-next-line no-restricted-globals -- the app's own object, never an engine's: ownKeys once, as Web IDL reads a record
	for (const key of Reflect.ownKeys(init)) {
		const descriptor = Object.getOwnPropertyDescriptor(init, key);
		if (descriptor === undefined || !descriptor.enumerable) continue;
		if (typeof key === "symbol") throw new TypeError("Headers can't take a symbol as a name.");
		// Web IDL's ByteString: the key is converted, and refused, before its value is read.
		if (/[\u0100-\uFFFF]/.test(key))
			throw new TypeError(`Headers can't take "${key}" as a name: it has a character past a byte.`);
		// Boundary: the record's value, read by name.
		const value = `${(init as Record<string, unknown>)[key] as string}`;
		if (/[\u0100-\uFFFF]/.test(value))
			throw new TypeError(
				`Headers can't take the value of "${key}": it has a character past a byte.`,
			);
		record.push([key, value]);
	}
	return record;
}

/** A header's name, checked and lowercased. */
function checkName(name: unknown): string {
	const text = `${name as string}`;
	if (!TOKEN.test(text)) throw new TypeError(`"${text}" is not a header name HTTP allows.`);
	return text.toLowerCase();
}

/** A header's value, its edges trimmed, checked. */
function checkValue(value: unknown): string {
	const text = `${value as string}`.replace(EDGE_WHITESPACE, "");
	if (NOT_A_VALUE.test(text)) throw new TypeError(`"${text}" is not a header value HTTP allows.`);
	return text;
}

/** What a Headers iterator gives: the pair, its name or its value. */
type IteratorKind = "entries" | "keys" | "values";

/** An iterator's headers, what it gives and how far it has gone. */
interface IteratorState {
	state: HeaderState;
	kind: IteratorKind;
	index: number;
}

const iterators = new WeakMap<object, IteratorState>();

/**
 * Web IDL § 3.7.10.1's default iterator prototype for `Headers`: a child of %IteratorPrototype%,
 * named `Headers Iterator`, whose `next` sorts and combines the list again at each step, so the
 * iteration sees what changed since it began (Fetch § 5.2: "the value pairs to iterate over").
 */
const HEADERS_ITERATOR: object = Object.create(
	Object.getPrototypeOf(Object.getPrototypeOf([][Symbol.iterator]())) as object,
	{
		next: {
			value: function next(this: unknown): IteratorResult<unknown> {
				const found = typeof this === "object" && this !== null ? iterators.get(this) : undefined;
				if (!found) throw new TypeError("Illegal invocation: not a Headers iterator.");
				const pairs = sorted(found.state);
				if (found.index >= pairs.length) return { value: undefined, done: true };
				const [name, value] = pairs[found.index++]!;
				return {
					value: found.kind === "keys" ? name : found.kind === "values" ? value : [name, value],
					done: false,
				};
			},
			writable: true,
			enumerable: true,
			configurable: true,
		},
		[Symbol.toStringTag]: { value: "Headers Iterator", configurable: true },
	},
);

/** A new iterator over `state`'s headers. */
function headersIterator<T>(state: HeaderState, kind: IteratorKind): IterableIterator<T> {
	const iterator = Object.create(HEADERS_ITERATOR) as object;
	iterators.set(iterator, { state, kind, index: 0 });
	// Boundary: the object above, which %IteratorPrototype% makes iterable.
	return iterator as IterableIterator<T>;
}

/** § 2.2.2 "sort and combine": by name, each name's values joined, each `set-cookie` apart. */
function sorted(state: HeaderState): [string, string][] {
	const names = [...new Set(state.list.map(([name]) => name))].sort();
	const result: [string, string][] = [];
	for (const name of names) {
		const values = state.list.filter(([each]) => each === name).map(([, value]) => value);
		if (name === "set-cookie") for (const value of values) result.push([name, value]);
		else result.push([name, values.join(", ")]);
	}
	return result;
}
