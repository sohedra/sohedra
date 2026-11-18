// Running a main-thread function: its body with a copy of its object, in which what it captured is
// what the body reads, and the engine's events with their targets made elements.

import { describe, expect, it } from "@rstest/core";

import type { Elements } from "../../../../src/main-thread/functions/element.ts";
import { createLifetimes } from "../../../../src/main-thread/functions/lifetimes.ts";
import { createRefs, Ref } from "../../../../src/main-thread/functions/refs.ts";
import { holdValue, made, prepare, runAs } from "../../../../src/main-thread/functions/run.ts";
import { functionsGlobal } from "../../../../src/main-thread/globals.ts";

/** Wrappers that are the element itself, tagged: enough to see where one was made. */
const elements: Elements = {
	wrap: (element) => ({ wrapped: element }) as never,
	forget() {},
	find: () => undefined,
	size: 0,
};

// oxlint-disable-next-line typescript/no-explicit-any -- a body reads its own object, of any shape
const register = (id: string, body: (this: any, ...args: never[]) => unknown) => {
	functionsGlobal().bodies[id] = body;
};

describe("a main-thread function's captures", () => {
	it("are made what the body reads: refs, elements and functions, and the rest as they came", () => {
		register("unit:inner", function (this: { _c: { n: number } }, by: number) {
			return this._c.n + by;
		});
		const refs = createRefs();
		const handle = { _jsFnId: 3 };
		const captures = {
			n: 1,
			ref: { _wvid: 5, _initValue: { open: false } },
			element: { elementRefptr: "engine element" },
			inner: { _wkltId: "unit:inner", _c: { n: 10 } },
			handle,
			plain: { deep: [1, 2] },
		};
		const read = made(captures, { refs, elements }, 0) as Record<string, unknown>;
		expect(read["n"]).toBe(1);
		expect(read["ref"]).toBeInstanceOf(Ref);
		expect((read["ref"] as Ref).current).toEqual({ open: false });
		expect(read["element"]).toEqual({ wrapped: "engine element" });
		expect((read["inner"] as (by: number) => number)(5)).toBe(15);
		expect(read["handle"]).toBe(handle);
		expect(read["plain"]).toBe(captures.plain);
		// The object as it came stays as it was: hydration reads it.
		expect(captures.ref).toEqual({ _wvid: 5, _initValue: { open: false } });
	});

	it("share one ref for one id, made from its initial value the first time", () => {
		const refs = createRefs();
		const first = made({ _wvid: 8, _initValue: 1 }, { refs, elements }, 0) as Ref;
		first.current = 2;
		const again = made({ _wvid: 8, _initValue: 1 }, { refs, elements }, 0) as Ref;
		expect(again).toBe(first);
		expect(again.current).toBe(2);
		expect(JSON.stringify(first)).toBe('{"_wvid":8}');
	});

	it("refuse a body that is not registered, by its id", () => {
		expect(() => prepare({ _wkltId: "unit:missing" }, { refs: createRefs(), elements })).toThrow(
			expect.objectContaining({ code: "main_thread_function_not_found" }),
		);
	});
});

describe("holding what a main-thread function was sent with", () => {
	it("counts the copy and each handle in it for its context, and tells each handle its context", () => {
		const held: number[] = [];
		const lifetimes = createLifetimes({ release: () => {}, soon: () => {} });
		const handle: Record<string, unknown> = { _jsFnId: 1 };
		const nested: Record<string, unknown> = { _jsFnId: 2 };
		holdValue(
			{
				_wkltId: "unit:held",
				_execId: 9,
				_jsFn: { _jsFn1: handle },
				_c: { inner: { _wkltId: "unit:nested", _jsFn: { _jsFn1: nested } } },
			},
			lifetimes,
		);
		held.push(...lifetimes.held());
		expect(held).toEqual([9]);
		expect([handle["_execId"], nested["_execId"]]).toEqual([9, 9]);
	});

	it("looks no further into a copy sent without a context", () => {
		const lifetimes = createLifetimes({ release: () => {}, soon: () => {} });
		const handle: Record<string, unknown> = { _isFirstScreen: true };
		holdValue({ _wkltId: "unit:plain", _jsFn: { _jsFn1: handle } }, lifetimes);
		expect(lifetimes.held()).toEqual([]);
		expect(handle["_execId"]).toBeUndefined();
	});
});

describe("running as the engine asks", () => {
	it("gives an event its targets as elements, and returns the bits that stop it", () => {
		const ready = (event: {
			target: unknown;
			stopPropagation(): void;
			stopImmediatePropagation(): void;
		}) => {
			event.stopPropagation();
			const { stopImmediatePropagation } = event;
			stopImmediatePropagation();
			return event.target;
		};
		const result = runAs(ready as never, {
			params: [{ type: "tap", target: { elementRefptr: "a" }, currentTarget: { uid: 1 } }],
			source: 1,
			elements,
		});
		expect(result).toEqual({ returnValue: { wrapped: "a" }, eventReturnResult: 3 });
	});

	it("gives a gesture's callback its event and the gesture manager", () => {
		const manager = { __SetGestureState() {} };
		const result = runAs(
			((event: { target: unknown }, given: unknown) => [event.target, given]) as never,
			{
				params: [{ target: { elementRefptr: "b" } }, manager],
				source: 2,
				elements,
			},
		);
		expect(result).toEqual([{ wrapped: "b" }, manager]);
	});

	it("passes a call's arguments as they are", () => {
		expect(
			runAs(((a: number, b: number) => a + b) as never, {
				params: [1, 2],
				source: undefined,
				elements,
			}),
		).toBe(3);
	});
});
