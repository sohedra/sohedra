// A top-level main-thread function's captured `$state`, read whole: the background copies it
// member by member as the function is made, so a change anywhere inside it makes the function again
// and sends it to the main thread. The first frame's copy matches the background's at hydration.
// A capture that cannot be copied (one that holds itself, or an element) is reported with its own
// message.

import { describe, expect, it } from "@rstest/core";

import CapturedCycle from "../../fixtures/threads/functions/CapturedCycle.svelte";
import drawCapturedCycle from "../../fixtures/threads/functions/CapturedCycle.svelte?first-frame";
import CapturedElement from "../../fixtures/threads/functions/CapturedElement.svelte";
import drawCapturedElement from "../../fixtures/threads/functions/CapturedElement.svelte?first-frame";
import CapturedState from "../../fixtures/threads/functions/CapturedState.svelte";
import drawCapturedState from "../../fixtures/threads/functions/CapturedState.svelte?first-frame";
import { startFunctionsPage, tap } from "./pages.ts";

const START = '{"size":{"n":0},"when":"1970-01-01T00:00:00.000Z"}';
const NESTED = '{"size":{"n":1},"when":"1970-01-01T00:00:00.000Z"}';
const DATED = '{"size":{"n":1},"when":"1970-01-01T00:00:01.000Z"}';

function capturing(firstFrame: boolean) {
	const log: unknown[] = [];
	const api: Record<string, () => void> = {};
	const page = startFunctionsPage(CapturedState, {
		draw: drawCapturedState,
		props: { log, api },
		firstFrame,
	});
	/** Runs `change` on the background, and waits for both threads. */
	const change = async (name: string) => {
		page.asBackground(() => api[name]!());
		await page.settle();
	};
	return { page, log, change };
}

describe("a main-thread function that captures $state whole", () => {
	it("is sent again with each change inside it, and the main thread runs the new copy", async () => {
		const { page, log, change } = capturing(false);
		await page.settle();
		await tap(page, "tap");
		await change("push");
		await tap(page, "tap");
		await change("nested");
		await tap(page, "tap");
		await change("count");
		await tap(page, "tap");
		await change("date");
		await tap(page, "tap");
		expect(log).toEqual([
			`ref ${START}`,
			`tap 1 ${START} 0`,
			`tap 1,2 ${START} 0`,
			`ref ${NESTED}`,
			`tap 1,2 ${NESTED} 0`,
			`tap 1,2 ${NESTED} 1`,
			`ref ${DATED}`,
			`tap 1,2 ${DATED} 1`,
		]);
		expect(page.errors).toEqual([]);
	});

	it("matches its first frame's copy at hydration, and is sent again once something inside changes", async () => {
		const { page, log, change } = capturing(true);
		await page.settle();
		// The function ref ran in the first frame, and hydration finds the same capture.
		expect(log).toEqual([`ref ${START}`]);
		await change("nested");
		await tap(page, "tap");
		expect(log).toEqual([`ref ${START}`, `ref ${NESTED}`, `tap 1 ${NESTED} 0`]);
		expect(page.errors).toEqual([]);
	});
});

describe("a captured $state that cannot be copied", () => {
	it("is reported when it holds itself, instead of overflowing the stack", async () => {
		const page = startFunctionsPage(CapturedCycle, { draw: drawCapturedCycle });
		await page.settle();
		expect(page.errors).toEqual([
			expect.objectContaining({
				code: "capture_too_deep",
				message: expect.stringMatching(
					/^A main-thread function captures tree, which holds itself or is nested more than 1000 levels deep[^\n]*\n.*CapturedCycle\.svelte:\d+:\d+/,
				),
			}),
		]);
	});

	it("is reported when it holds an element, which the function should reach through a ref", async () => {
		const page = startFunctionsPage(CapturedElement, { draw: drawCapturedElement });
		await page.settle();
		expect(page.errors).toEqual([
			expect.objectContaining({
				code: "element_in_main_thread_function",
				message: expect.stringMatching(
					/^A main-thread function captures box, which holds the <view> element of the background[^\n]*\n.*CapturedElement\.svelte:\d+:\d+[\s\S]*main-thread:ref=\{ref\}/,
				),
			}),
		]);
	});
});
