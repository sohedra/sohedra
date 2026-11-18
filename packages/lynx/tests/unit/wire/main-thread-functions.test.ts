// The shapes main-thread functions, their handles and refs travel in, as each thread tells them.

import { describe, expect, it } from "@rstest/core";

import {
	FIRST_FRAME_HANDLE,
	isBackgroundHandle,
	isMainThreadFunction,
	isRefHandle,
} from "../../../src/wire/index.ts";

describe("what travels for main-thread functions", () => {
	it("tells a function, a ref and a handle apart", () => {
		const values = [
			{ _wkltId: "f" },
			{ _wvid: 1, _initValue: 0 },
			{ _wvid: 2, _initValue: 0, _type: "reserved" },
			{ _jsFnId: 3 },
			{ _isFirstScreen: true },
			{ _wvid: "1" },
			null,
			"f",
		];
		expect(values.map(isMainThreadFunction)).toEqual([
			true,
			false,
			false,
			false,
			false,
			false,
			false,
			false,
		]);
		expect(values.map(isRefHandle)).toEqual([false, true, true, false, false, false, false, false]);
		expect(values.map(isBackgroundHandle)).toEqual([
			false,
			false,
			false,
			true,
			true,
			false,
			false,
			false,
		]);
	});

	it("writes the first frame's handle as the build puts it in a function", () => {
		expect(FIRST_FRAME_HANDLE).toBe("{ _isFirstScreen: true }");
	});
});
