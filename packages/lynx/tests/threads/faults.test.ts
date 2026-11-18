// What goes wrong on the page is reported into Lynx, and the page goes on.

import { describe, expect, it } from "@rstest/core";

import { startMainThread } from "../../src/main-thread/index.ts";
import { installGlobals, readGlobal } from "../../src/testing/globals.ts";
import { startTestPage } from "../../src/testing/index.ts";
import { encodeCall, encodePatch, OpCode, PATCH_METHOD, ROOT_ID } from "../../src/wire/index.ts";
import Fails from "../fixtures/threads/Fails.svelte";
import Faults from "../fixtures/threads/Faults.svelte";
import { startSveltePage } from "./svelte-page.ts";

describe("an attribute value that cannot be sent", () => {
	it("is reported with the attribute and the element, which is made without it, on the page and in a cell", async () => {
		const page = startSveltePage(Faults);
		await page.settle();
		expect(page.engine.state(page.byClass("unsendable")).attrs["title"]).toBe("kept");
		expect(page.engine.state(page.byClass("unsendable")).dataset).toEqual({});
		const reported = page.errors.filter(
			(error) => (error as { code?: unknown }).code === "attribute_not_copyable",
		);
		expect(reported).toHaveLength(2);
		expect(reported[0]).toMatchObject({
			message: expect.stringMatching(/^The value of data-big on <view> cannot be sent/),
		});
	});
});

describe("a handler that throws", () => {
	it("is reported, and its update still reaches the page", async () => {
		const page = startSveltePage(Faults);
		await page.settle();
		page.engine.dispatch(page.byClass("throws"), { type: "tap" });
		await page.settle();
		expect(page.errors).toContainEqual(expect.objectContaining({ message: "the handler threw" }));
		expect(page.engine.text(page.byClass("taps"))).toBe("1");
	});
});

describe("a component that throws as the page starts", () => {
	it("is reported, and nothing is thrown at the engine", async () => {
		const page = startSveltePage(Fails);
		await page.settle();
		expect(page.errors).toContainEqual(
			expect.objectContaining({ message: expect.stringMatching(/^the component threw/) }),
		);
	});
});

describe("the main thread", () => {
	it("applies a patch that came before the engine rendered the page once it does, and skips replies", () => {
		const page = startTestPage({
			mainThread: () => {
				startMainThread();
				const patch = readGlobal(PATCH_METHOD) as (params: { data: string }) => void;
				patch(
					encodePatch({
						page: 0,
						items: [
							[
								"ops",
								[
									[OpCode.Create, 2, "view"],
									[OpCode.Insert, ROOT_ID, 2, 0],
								],
							],
							["reply", 1, "{}"],
						],
					}),
				);
			},
		});
		expect(page.engine.all().map((element) => page.engine.state(element).tag)).toEqual([
			"page",
			"view",
		]);
		expect(page.errors).toEqual([]);
	});

	it("reports once a call of a main-thread function it has no body for, which wants no answer", async () => {
		const page = startTestPage({ mainThread: () => startMainThread() });
		const patch = readGlobal(PATCH_METHOD) as (params: { data: string }) => void;
		page.asMainThread(() =>
			patch(
				encodePatch({
					page: 0,
					items: [["call", 0, 0, encodeCall(["run", { _wkltId: "a1b2:c3d4:9" }, []])]],
				}),
			),
		);
		expect(page.errors).toEqual([
			expect.objectContaining({
				code: "main_thread_function_not_found",
				message: expect.stringMatching(/^The main-thread function a1b2:c3d4:9 has no body/),
			}),
		]);
	});

	it("reports with Lynx's code for the main thread where the engine has _ReportError", () => {
		const reports: unknown[] = [];
		const page = startTestPage({ mainThread: () => startMainThread() });
		const restore = installGlobals({
			_ReportError: (error: Error, options: unknown) => reports.push([error.message, options]),
		});
		try {
			const patch = readGlobal(PATCH_METHOD) as (params: { data: string }) => void;
			page.asMainThread(() =>
				patch(
					encodePatch({
						page: 0,
						items: [
							["ops", [[OpCode.Release, 9]]],
							["call", 0, 9, encodeCall(["invoke", "x", {}])],
						],
					}),
				),
			);
		} finally {
			restore();
		}
		expect(reports).toEqual([
			[expect.stringMatching(/^The main thread has no element 9\.\n/), { errorCode: 1101 }],
		]);
	});
});
