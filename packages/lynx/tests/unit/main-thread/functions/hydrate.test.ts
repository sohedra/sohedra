// What hydration carries from the first frame's copy of a main-thread function into the
// background's, and when two copies are the same function.

import { describe, expect, it } from "@rstest/core";

import { sameFunction } from "../../../../src/main-thread/functions/bindings.ts";
import { carry } from "../../../../src/main-thread/functions/hydrate.ts";
import { createLifetimes } from "../../../../src/main-thread/functions/lifetimes.ts";
import { createRefs } from "../../../../src/main-thread/functions/refs.ts";

function scope() {
	return { refs: createRefs(), lifetimes: createLifetimes({ release: () => {}, soon: () => {} }) };
}

describe("hydration's walk", () => {
	it("makes a background ref the first frame's ref of the same place, when the first frame made it", () => {
		const carried = scope();
		const made = carried.refs.of({ _wvid: -1, _initValue: 0 });
		made.current = 4;
		carry(
			{
				_wkltId: "f",
				_c: { count: { _wvid: 7, _initValue: 0 }, other: { _wvid: 8, _initValue: 1 } },
			},
			{
				_wkltId: "f",
				_c: { count: { _wvid: -1, _initValue: 0 }, other: { _wvid: -2, _initValue: 1 } },
			},
			carried,
		);
		expect(carried.refs.of({ _wvid: 7, _initValue: 0 })).toBe(made);
		// One the first frame never made starts from its initial value.
		expect(carried.refs.of({ _wvid: 8, _initValue: 1 }).current).toBe(1);
	});

	it("names the background's functions in the first frame's handles, nested ones too, and holds them", () => {
		const carried = scope();
		const first = { _isFirstScreen: true } as Record<string, unknown>;
		const nested = { _isFirstScreen: true } as Record<string, unknown>;
		carry(
			{
				_wkltId: "f",
				_execId: 5,
				_jsFn: { _jsFn1: { _jsFnId: 11 } },
				_c: { inner: { _wkltId: "g", _jsFn: { _jsFn1: { _jsFnId: 12 } } } },
			},
			{
				_wkltId: "f",
				_jsFn: { _jsFn1: first },
				_c: { inner: { _wkltId: "g", _jsFn: { _jsFn1: nested } } },
			},
			carried,
		);
		expect(first).toEqual({ _jsFnId: 11, _execId: 5 });
		expect(nested).toEqual({ _jsFnId: 12, _execId: 5 });
		expect(carried.lifetimes.held()).toEqual([5]);
	});

	it("carries nothing between different functions", () => {
		const carried = scope();
		carried.refs.of({ _wvid: -1, _initValue: 0 });
		carry(
			{ _wkltId: "f", _c: { r: { _wvid: 3 } } },
			{ _wkltId: "g", _c: { r: { _wvid: -1 } } },
			carried,
		);
		expect(carried.refs.find(3)).toBeUndefined();
	});
});

describe("two copies of a main-thread function", () => {
	it("are the same with the same body and captures, whatever their refs' ids and handles", () => {
		expect(
			sameFunction(
				{ _wkltId: "f", _c: { n: 1, r: { _wvid: 3 } }, _jsFn: { a: { _jsFnId: 1 } }, _execId: 2 },
				{ _wkltId: "f", _c: { n: 1, r: { _wvid: -1 } }, _jsFn: { a: { _isFirstScreen: true } } },
			),
		).toBe(true);
	});

	it("differ in a captured value, a nested function's capture, or their body", () => {
		const a = { _wkltId: "f", _c: { where: "frame", inner: { _wkltId: "g", _c: { n: 1 } } } };
		expect(sameFunction(a, { ...a, _c: { ...a._c, where: "background" } })).toBe(false);
		expect(sameFunction(a, { ...a, _c: { ...a._c, inner: { _wkltId: "g", _c: { n: 2 } } } })).toBe(
			false,
		);
		expect(sameFunction(a, { ...a, _wkltId: "h" })).toBe(false);
		expect(
			sameFunction(
				{ _wkltId: "f", _c: { n: Number.NaN } },
				{ _wkltId: "f", _c: { n: Number.NaN } },
			),
		).toBe(true);
	});
});
