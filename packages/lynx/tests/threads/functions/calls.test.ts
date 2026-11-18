// Calls between the threads. `runOnMainThread` rides in the patch after the changes made before it,
// and `runOnBackground` runs its function as the background runs an event's handlers. Each resolves
// with what the function returned, a thenable awaited, and rejects with what it threw; the throw is
// reported once, on the thread it ran on, and a call nobody awaits reports nothing more.

import { describe, expect, it } from "@rstest/core";

import { encodeToBackground } from "../../../src/wire/index.ts";
import Calls from "../../fixtures/threads/functions/Calls.svelte";
import drawCalls from "../../fixtures/threads/functions/Calls.svelte?first-frame";
import { startFunctionsPage, tap } from "./pages.ts";

async function calls() {
	const log: unknown[][] = [];
	const api: Record<string, (...args: never[]) => Promise<unknown>> = {};
	const page = startFunctionsPage(Calls, { draw: drawCalls, props: { log, api } });
	await page.settle();
	/** Calls `name` on the background, and settles what it awaits. */
	const call = async (name: string, ...args: unknown[]): Promise<unknown> => {
		const answer = page.asBackground(() => api[name]!(...(args as never[])));
		await page.settle();
		return answer;
	};
	return { page, log, call };
}

describe("runOnMainThread", () => {
	it("resolves with what the function returned, given its arguments", async () => {
		const { page, call } = await calls();
		expect(await call("add", 2, 3)).toEqual({ sum: 5 });
		expect(page.errors).toEqual([]);
	});

	it("rides in the patch after the changes made before it, so it sees them after tick()", async () => {
		const { call } = await calls();
		expect(await call("count")).toBe(5);
		expect(await call("count")).toBe(10);
	});

	it("awaits a thenable the function returns", async () => {
		const { call } = await calls();
		expect(await call("wait", "it")).toBe("waited for it");
	});

	it("lets a UI method of an element made in the same patch wait for its view", async () => {
		const { page, call } = await calls();
		page.engine.respondWith(() => ({ code: 0, data: { width: 7 } }));
		expect(await call("measure")).toEqual({ width: 7 });
		expect(page.errors).toEqual([]);
	});

	it("rejects with what the function threw, which the main thread reports once", async () => {
		const { page, call } = await calls();
		await expect(call("fail")).rejects.toMatchObject({
			name: "TypeError",
			message: "The main thread failed.",
		});
		expect(page.errors).toEqual([expect.objectContaining({ message: "The main thread failed." })]);
	});

	it("runs a main-thread function at once from another one", async () => {
		const { page, log } = await calls();
		await tap(page, "nested");
		await page.settle();
		expect(log).toEqual([["nested", { sum: 3 }]]);
	});

	it("rejects a plain function, and says so in a development build", async () => {
		const { page, call } = await calls();
		await expect(call("plain")).rejects.toMatchObject({ code: "not_a_main_thread_function" });
		expect(page.errors).toEqual([
			expect.objectContaining({
				message: expect.stringMatching(
					/^The value given to runOnMainThread, plain, is not a main-thread function/,
				),
			}),
		]);
	});
});

describe("runOnBackground", () => {
	it("resolves with what the background function returned, awaited, and rejects with its throw", async () => {
		const { page, log } = await calls();
		await tap(page, "ask");
		await page.settle();
		expect(log).toEqual(
			expect.arrayContaining([
				["answer", 42],
				["later", "later 1"],
				["caught", "RangeError", "The background failed."],
			]),
		);
		// The background reported its function's throw; the main thread's catch had it too.
		expect(page.errors).toEqual([expect.objectContaining({ message: "The background failed." })]);
	});

	it("reports a rejection nobody awaits once, where the function threw", async () => {
		const { page } = await calls();
		await tap(page, "ignore");
		await page.settle();
		expect(page.errors).toEqual([expect.objectContaining({ message: "The background failed." })]);
	});

	it("answers a call of a function the background no longer has with an error, and reports it", async () => {
		const { page } = await calls();
		page.asMainThread(() =>
			page.lynx.mainThread
				.getJSContext()
				.dispatchEvent(
					encodeToBackground({ t: "call", id: 99, fn: 1, context: 999_999, params: [] }, 0),
				),
		);
		await page.settle();
		const reply = page.patches.flatMap((patch) => patch.items).find((item) => item[0] === "reply");
		expect(reply?.[1]).toBe(99);
		expect(JSON.parse(String(reply?.[2]))).toMatchObject({
			ok: false,
			error: { code: "background_function_missing" },
		});
		expect(page.errors).toEqual([expect.objectContaining({ code: "background_function_missing" })]);
	});
});
