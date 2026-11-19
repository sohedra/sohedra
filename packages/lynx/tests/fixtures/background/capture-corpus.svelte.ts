// Kinds of captured value, for comparing a copy of a capture with `$state.snapshot`. Each case
// makes its state, and says what the function reads and the changes to make after. `run` reads the
// value through `copy` inside a `$derived`, as a compiled main-thread function does, and gives what
// would be sent: at once, and later, after the changes, if it was held until then; and what each
// change made of it.

import { flushSync, untrack } from "svelte";
import { SvelteDate, SvelteMap, SvelteSet } from "svelte/reactivity";

/** A copy of a captured value: `$state.snapshot`, or the binding's. */
export type Copy = (value: unknown) => unknown;

/** What the function reads, and the changes to make after, each with its name. */
interface Case {
	read: () => unknown;
	changes: [string, () => void][];
}

class Point {
	x: number;
	y: number;
	constructor(x: number, y: number) {
		this.x = x;
		this.y = y;
	}
	get sum() {
		return this.x + this.y;
	}
}

class Counter {
	count = $state(0);
	list = $state([1]);
}

class WithJson {
	v: unknown;
	constructor(v: unknown) {
		this.v = v;
	}
	toJSON() {
		return { j: this.v };
	}
}

class Holder {
	inner: unknown;
	constructor(inner: unknown) {
		this.inner = inner;
	}
}

class WithFunction {
	cb = () => 1;
	n = 1;
}

/** The snapshot itself, as an app writes it. */
export const snapshot: Copy = (value) => $state.snapshot(value);

export const cases: Record<string, () => Case> = {
	primitive_number() {
		let s = $state(0);
		return { read: () => s, changes: [["++", () => s++]] };
	},
	primitive_undefined() {
		let s: unknown = $state();
		return { read: () => s, changes: [["set", () => (s = 1)]] };
	},
	plain_nested() {
		let s: Record<string, unknown> = $state({ a: { b: [1, { c: 2 }] }, d: "x" });
		const a = () => s["a"] as { b: [number, { c: number }, ...number[]] };
		return {
			read: () => s,
			changes: [
				["deep", () => (a().b[1].c = 3)],
				["push", () => a().b.push(4)],
				["add key", () => (s["e"] = 1)],
				["delete key", () => delete s["d"]],
				["reassign", () => (s = { z: 1 })],
			],
		};
	},
	array_sparse() {
		// eslint-disable-next-line no-sparse-arrays
		const s = $state([1, , 3]);
		return {
			read: () => s,
			changes: [
				["fill hole", () => (s[1] = 2)],
				["length", () => (s.length = 1)],
			],
		};
	},
	array_extra_prop() {
		const a = Object.assign([1], { extra: "e" });
		const s = $state(a);
		return { read: () => s, changes: [["extra", () => (s.extra = "f")]] };
	},
	cycle() {
		const o: { n: number; self?: unknown } = { n: 1 };
		o.self = o;
		const s = $state(o);
		return { read: () => s, changes: [["n", () => (s.n = 2)]] };
	},
	shared_reference() {
		const leaf = { n: 1 };
		const s = $state({ a: leaf, b: leaf });
		return { read: () => s, changes: [["a.n", () => (s.a.n = 2)]] };
	},
	map_plain() {
		const s = $state({ m: new Map<string, unknown>([["k", { n: 1 }]]) });
		return { read: () => s, changes: [["map set (untracked)", () => s.m.set("k2", 1)]] };
	},
	svelte_map() {
		const m = new SvelteMap([["k", 1]]);
		const s = $state({ m });
		return {
			read: () => s,
			changes: [
				["SvelteMap set", () => m.set("k2", 2)],
				["SvelteMap same key", () => m.set("k", 9)],
			],
		};
	},
	svelte_set() {
		const m = new SvelteSet([1]);
		const s = $state({ m });
		return { read: () => s, changes: [["SvelteSet add", () => m.add(2)]] };
	},
	date() {
		const s = $state({ d: new Date(0) });
		return {
			read: () => s,
			changes: [
				["setTime in place (untracked)", () => s.d.setTime(5)],
				["reassign", () => (s.d = new Date(9))],
			],
		};
	},
	date_invalid() {
		const s = $state({ d: new Date(NaN) });
		return { read: () => s, changes: [] };
	},
	svelte_date() {
		const d = new SvelteDate(0);
		const s = $state({ d });
		return { read: () => s, changes: [["SvelteDate setTime", () => d.setTime(5)]] };
	},
	class_instance() {
		const p = new Point(1, 2);
		const s = $state({ p });
		return { read: () => s, changes: [["p.x in place (untracked)", () => (p.x = 9)]] };
	},
	class_instance_top() {
		const p = new Point(1, 2);
		let s = $state(p);
		return {
			read: () => s,
			changes: [
				["p.x in place (untracked)", () => (p.x = 9)],
				["reassign", () => (s = new Point(3, 4))],
			],
		};
	},
	class_state_fields() {
		const c = new Counter();
		const s = $state({ c });
		return {
			read: () => s,
			changes: [
				["c.count++", () => c.count++],
				["c.list.push", () => c.list.push(2)],
			],
		};
	},
	class_holding_proxy() {
		const inner = $state({ n: 1 });
		const h = new Holder(inner);
		const s = $state({ h });
		return { read: () => s, changes: [["inner.n", () => (inner.n = 2)]] };
	},
	class_with_function_field() {
		const s = $state({ f: new WithFunction() });
		return { read: () => s, changes: [] };
	},
	tojson_class() {
		const w = new WithJson({ n: 1 });
		const s = $state({ w });
		return { read: () => s, changes: [["w.v reassign (untracked)", () => (w.v = { n: 2 })]] };
	},
	tojson_class_over_state() {
		const inner = $state({ n: 1 });
		const w = new WithJson(inner);
		const s = $state({ w });
		return { read: () => s, changes: [["inner.n", () => (inner.n = 2)]] };
	},
	tojson_plain() {
		const s = $state({
			a: 1,
			toJSON() {
				return { doubled: this.a * 2 };
			},
		});
		return { read: () => s, changes: [["a", () => (s.a = 5)]] };
	},
	getter_plain() {
		const s = $state({
			a: 1,
			b: 2,
			get sum() {
				return this.a + this.b;
			},
		});
		return { read: () => s, changes: [["a", () => (s.a = 5)]] };
	},
	symbol_key_and_value() {
		const k = Symbol("k");
		const s: Record<string | symbol, unknown> = $state({ [k]: 1, v: Symbol("v"), n: 1 });
		return { read: () => s, changes: [["symbol key", () => (s[k] = 2)]] };
	},
	function_member() {
		const s = $state({
			f() {
				return 1;
			},
			n: 1,
		});
		return { read: () => s, changes: [["n", () => (s.n = 2)]] };
	},
	null_proto() {
		const o = Object.create(null) as { n: number };
		o.n = 1;
		const s = $state({ o });
		return { read: () => s, changes: [["o.n in place (untracked)", () => (o.n = 2)]] };
	},
	raw() {
		let r = $state.raw({ n: 1 });
		return {
			read: () => r,
			changes: [
				["in place (untracked)", () => (r.n = 2)],
				["reassign", () => (r = { n: 3 })],
			],
		};
	},
	raw_inside_state() {
		const big = Object.freeze({ n: 1 });
		const s: { big: unknown } = $state({ big: null });
		s.big = big;
		return { read: () => s, changes: [] };
	},
	user_proxy() {
		const target = { n: 1 };
		const p = new Proxy(target, {
			get: (t, k) => (k === "virtual" ? 42 : t[k as keyof typeof t]),
		});
		const s = $state({ p });
		return { read: () => s, changes: [["p.n via state", () => (s.p.n = 2)]] };
	},
	state_in_state() {
		const inner = $state({ n: 1 });
		const s = $state({ inner });
		return { read: () => s, changes: [["inner.n direct", () => (inner.n = 2)]] };
	},
	typed_array() {
		const s = $state({ t: new Uint8Array([1, 2]) });
		return { read: () => s, changes: [] };
	},
	boxed_regexp_error() {
		const s = $state({ n: new Number(1), r: /x/g, e: new Error("boom") });
		return { read: () => s, changes: [] };
	},
	bigint() {
		const s = $state({ b: 1n });
		return { read: () => s, changes: [] };
	},
	nan_negzero_undefined_member() {
		const s = $state({ a: NaN, b: -0, c: undefined, d: [undefined] });
		return { read: () => s, changes: [] };
	},
	main_thread_function_in_state() {
		const fn = () => 1;
		const s = $state({
			h: { _c: { n: 1 }, _wkltId: "a:1", _jsFn: { _jsFn1: { _jsFnId: 1, _fn: fn } } },
		});
		return { read: () => s, changes: [["_c.n", () => (s.h._c.n = 2)]] };
	},
};

/** The value as it would be sent, or what sending it throws. */
function json(value: unknown): string | undefined {
	try {
		return JSON.stringify(value);
	} catch (error) {
		return `throws ${(error as Error).name}`;
	}
}

/** What a case gives through `copy`. */
export interface Outcome {
	/** What was sent at once. */
	first: string | undefined;
	/** The first copy, sent after every change. */
	firstSentLater: string | undefined;
	/** What each change made: the copy then sent, or "no rebuild". */
	changes: Record<string, string | undefined>;
	/** What reading the value through `copy` threw. */
	error: unknown;
}

/** Runs the case `name` through `copy`. */
export function run(name: string, copy: Copy): Outcome {
	const { read, changes } = cases[name]!();
	const runs: (string | undefined)[] = [];
	let held: unknown;
	let error: unknown;
	const stop = $effect.root(() => {
		const copied = $derived.by(() => {
			try {
				return copy(read());
			} catch (thrown) {
				error = thrown;
				return undefined;
			}
		});
		$effect.pre(() => {
			held = copied;
			untrack(() => runs.push(json(copied)));
		});
	});
	flushSync();
	const first = held;
	const made: Record<string, string | undefined> = {};
	for (const [label, change] of changes) {
		const before = runs.length;
		change();
		flushSync();
		made[label] = runs.length > before ? runs[runs.length - 1] : "no rebuild";
	}
	stop();
	return { first: runs[0], firstSentLater: json(first), changes: made, error };
}
