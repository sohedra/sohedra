// A call between the threads whose function returns what cannot be copied (a `BigInt`): the thread
// that writes the reply reports `value_not_copyable` once, as it reports a function's throw, and the
// call rejects with it, whether anybody awaits it or not.

import { describe, expect, it } from "@rstest/core";

import Calls from "../../fixtures/threads/functions/Calls.svelte";
import drawCalls from "../../fixtures/threads/functions/Calls.svelte?first-frame";
import { startFunctionsPage, tap } from "../functions/pages.ts";

async function calls() {
	const log: unknown[][] = [];
	const api: Record<string, () => Promise<unknown>> = {};
	const heard: [string | undefined, string][] = [];
	const page = startFunctionsPage(Calls, {
		draw: drawCalls,
		props: { log, api },
		onError: (_error, context) => void heard.push([context.code, context.thread]),
	});
	await page.settle();
	return { page, log, api, heard };
}

describe("a background function's result that cannot be copied", () => {
	it("is reported on the background when nobody awaits the call", async () => {
		const { page, heard } = await calls();
		await tap(page, "big-ignored");
		await page.settle();
		expect(heard).toEqual([["value_not_copyable", "background"]]);
		expect(page.errors).toEqual([expect.objectContaining({ code: "value_not_copyable" })]);
	});

	it("is reported on the background, and rejects the call that awaits it", async () => {
		const { page, log, heard } = await calls();
		await tap(page, "big-caught");
		await page.settle();
		expect(log).toEqual([["caught", "value_not_copyable"]]);
		expect(heard).toEqual([["value_not_copyable", "background"]]);
	});
});

describe("a main-thread function's result that cannot be copied", () => {
	it("is reported on the main thread, and rejects the call", async () => {
		const { page, api, heard } = await calls();
		const answer = page.asBackground(() => api["bigResult"]!());
		await page.settle();
		await expect(answer).rejects.toMatchObject({ code: "value_not_copyable" });
		expect(heard).toEqual([["value_not_copyable", "main-thread"]]);
	});
});
