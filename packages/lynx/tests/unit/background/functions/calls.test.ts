// The background's half of main-thread functions with no page running: refs, handles of background
// functions, and the calls that need a page.

import { describe, expect, it } from "@rstest/core";

import { transformToWorklet } from "../../../../src/background/functions/calls.ts";
import {
	mainThreadRef,
	runOnBackground,
	runOnMainThread,
} from "../../../../src/background/root-entry.ts";
import { installGlobals } from "../../../../src/testing/globals.ts";

describe("a main-thread ref on the background", () => {
	it("crosses as its id and its initial value, and leaves its reserved type field free", () => {
		const ref = mainThreadRef({ open: false });
		const sent = JSON.parse(JSON.stringify(ref)) as Record<string, unknown>;
		expect(Object.keys(sent).toSorted()).toEqual(["_initValue", "_wvid"]);
		expect(sent["_initValue"]).toEqual({ open: false });
		expect(JSON.parse(JSON.stringify(mainThreadRef())) as unknown).toEqual({
			_wvid: (sent["_wvid"] as number) + 1,
		});
	});

	it("reads its initial value here, and refuses a new one", () => {
		const restore = installGlobals({ lynx: { reportError() {} } });
		const ref = mainThreadRef(3);
		expect(ref.current).toBe(3);
		expect(() => {
			ref.current = 4;
		}).toThrow(expect.objectContaining({ code: "main_thread_ref_set_on_background" }));
		restore();
	});
});

describe("calls with no page running", () => {
	it("reject runOnMainThread, a plain function first", async () => {
		const restore = installGlobals({ lynx: { reportError() {} } });
		await expect(runOnMainThread(() => 1)()).rejects.toMatchObject({
			code: "not_a_main_thread_function",
		});
		await expect(
			runOnMainThread({ _wkltId: "f" } as unknown as () => void)(),
		).rejects.toMatchObject({ code: "page_is_gone" });
		restore();
	});

	it("throw for runOnBackground, which works only in a main-thread function", () => {
		function save() {}
		expect(() => runOnBackground(save)).toThrow(
			expect.objectContaining({
				code: "run_on_background_outside_main_thread",
				message: expect.stringMatching(/^A call of runOnBackground\(save\) ran on the background/),
			}),
		);
	});
});

describe("a handle of a background function", () => {
	it("crosses as its id alone, a new one for each handle", () => {
		const first = transformToWorklet(() => {});
		const second = transformToWorklet("not a function");
		expect(JSON.parse(JSON.stringify(first))).toEqual({ _jsFnId: first._jsFnId });
		expect(second._jsFnId).toBe(first._jsFnId! + 1);
		expect(second._fn).toBeUndefined();
	});
});
