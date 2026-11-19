// The page's own main-thread code's side of main-thread functions: the registry compiled code
// registers bodies with, refs the first frame makes, and calls, which reach the main thread's
// runtime through the global they share.

import { describe, expect, it } from "@rstest/core";

import * as backgroundFunctions from "../../../src/background/functions-entry.ts";
import * as functions from "../../../src/first-frame/functions-entry.ts";
import { functionsGlobal } from "../../../src/first-frame/globals.ts";
import {
	mainThreadRef,
	runOnBackground,
	runOnMainThread,
} from "../../../src/first-frame/root-entry.ts";
import { readGlobal } from "../../../src/testing/globals.ts";
import { REGISTER_FUNCTION } from "../../../src/wire/index.ts";

describe("the main thread's entry of compiled main-thread functions", () => {
	it("puts the registry in place, which registers a body by its id", () => {
		expect(functions.loadWorkletRuntime()).toBe(true);
		const body = () => "ran";
		(readGlobal(REGISTER_FUNCTION) as (kind: string, id: string, fn: unknown) => void)(
			"main-thread",
			"unit:registered",
			body,
		);
		expect(functionsGlobal().bodies["unit:registered"]).toBe(body);
		expect(functions.transformToWorklet(() => {})).toEqual({ _isFirstScreen: true });
		// The background registers nothing.
		expect(backgroundFunctions.loadWorkletRuntime()).toBe(false);
	});
});

describe("a ref the first frame makes", () => {
	it("has an id of the first frame's own, its initial value, and refuses a new one", () => {
		const first = mainThreadRef({ open: true });
		const second = mainThreadRef();
		const sent = JSON.parse(JSON.stringify(first)) as { _wvid: number; _initValue: unknown };
		expect(sent._wvid).toBeLessThan(0);
		expect(JSON.parse(JSON.stringify(second))).toEqual({ _wvid: sent._wvid - 1 });
		expect(first.current).toEqual({ open: true });
		expect(() => {
			first.current = { open: false };
		}).toThrow(expect.objectContaining({ code: "main_thread_ref_set_outside_function" }));
	});
});

describe("a call before the main thread's runtime started", () => {
	it("rejects, naming the call", async () => {
		const shared = functionsGlobal();
		const runtime = shared.runtime;
		delete shared.runtime;
		try {
			await expect(runOnMainThread(() => 1)()).rejects.toMatchObject({
				code: "main_thread_runtime_missing",
				message: expect.stringMatching(/^A call of runOnMainThread ran on the main thread/),
			});
			await expect(runOnBackground(() => 1)()).rejects.toMatchObject({
				code: "main_thread_runtime_missing",
			});
		} finally {
			if (runtime) shared.runtime = runtime;
		}
	});

	it("goes to the runtime once it started", async () => {
		const shared = functionsGlobal();
		const runtime = shared.runtime;
		shared.runtime = {
			runOnMainThread: (fn, params) => Promise.resolve(["main", fn, params]),
			runOnBackground: (fn, params) => Promise.resolve(["background", fn, params]),
			reportError: () => {},
		};
		try {
			const fn = () => 1;
			expect(await runOnMainThread(fn)()).toEqual(["main", fn, []]);
			expect(await runOnBackground(fn)()).toEqual(["background", fn, []]);
		} finally {
			if (runtime) shared.runtime = runtime;
			else delete shared.runtime;
		}
	});
});
