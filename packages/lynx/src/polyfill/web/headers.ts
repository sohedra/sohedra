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
			if (Symbol.iterator in init) {
				for (const pair of init as Iterable<unknown>) {
					// Boundary: a pair of the list, which the standard checks.
					const entry = [...(pair as Iterable<unknown>)];
					if (entry.length !== 2) throw new TypeError("Headers takes pairs of a name and a value.");
					this.append(`${entry[0] as string}`, `${entry[1] as string}`);
				}
				return;
			}
			for (const name of Object.keys(init))
				this.append(name, `${(init as Record<string, string>)[name]}`);
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

		*entries(): IterableIterator<[string, string]> {
			yield* sorted(stateOf(this));
		}

		*keys(): IterableIterator<string> {
			for (const [name] of sorted(stateOf(this))) yield name;
		}

		*values(): IterableIterator<string> {
			for (const [, value] of sorted(stateOf(this))) yield value;
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
