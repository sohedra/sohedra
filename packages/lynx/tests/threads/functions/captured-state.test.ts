// A top-level main-thread function's captured `$state`, read whole: the background copies it
// member by member as the function is made, so a change anywhere inside it makes the function again
// and sends it to the main thread. The first frame's copy matches the background's at hydration.
// A capture that cannot be copied (one that holds itself, or an element) is reported with its own
// message, the function is not sent, and the page goes on.

import { describe, expect, it } from "@rstest/core";

import CapturedCycle from "../../fixtures/threads/functions/CapturedCycle.svelte";
import drawCapturedCycle from "../../fixtures/threads/functions/CapturedCycle.svelte?first-frame";
import CapturedElement from "../../fixtures/threads/functions/CapturedElement.svelte";
import drawCapturedElement from "../../fixtures/threads/functions/CapturedElement.svelte?first-frame";
import CapturedOwnProxy from "../../fixtures/threads/functions/CapturedOwnProxy.svelte";
import drawCapturedOwnProxy from "../../fixtures/threads/functions/CapturedOwnProxy.svelte?first-frame";
import CapturedState from "../../fixtures/threads/functions/CapturedState.svelte";
import drawCapturedState from "../../fixtures/threads/functions/CapturedState.svelte?first-frame";
import { startFunctionsPage, tap } from "./pages.ts";
import type { Draw } from "./pages.ts";

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

/** Starts a page whose main-thread function cannot be sent, with a count to change after. */
function failing(App: typeof CapturedCycle, draw: Draw, firstFrame: boolean) {
	const log: unknown[] = [];
	const api: Record<string, () => void> = {};
	const page = startFunctionsPage(App, { draw, props: { log, api }, firstFrame });
	const count = async () => {
		page.asBackground(() => api["count"]!());
		await page.settle();
	};
	return { page, log, count };
}

describe.each([false, true])(
	"captured state that cannot be copied, with a first frame: %s",
	(firstFrame) => {
		it("is reported when it holds itself, and the page goes on drawing", async () => {
			const { page, count } = failing(CapturedCycle, drawCapturedCycle, firstFrame);
			await page.settle();
			// The first frame cannot write the cycle either, and says so (`first_frame_threw`).
			expect(page.errors).toHaveLength(firstFrame ? 2 : 1);
			expect(page.errors).toContainEqual(
				expect.objectContaining({
					code: "capture_too_deep",
					message: expect.stringMatching(
						/^The main-thread function of main-thread:ontap on <view> captures tree, which holds itself or is nested more than 500 levels deep[^\n]*\n.*CapturedCycle\.svelte:\d+:\d+/,
					),
				}),
			);
			expect(page.engine.texts()).toEqual(["count 0", "tap"]);
			await count();
			expect(page.engine.texts()).toEqual(["count 1", "tap"]);
		});

		it("is reported when it is given its own proxy to hold, and the page goes on drawing", async () => {
			const log: unknown[] = [];
			const api: Record<string, () => void> = {};
			const page = startFunctionsPage(CapturedOwnProxy, {
				draw: drawCapturedOwnProxy,
				props: { log, api },
				firstFrame,
			});
			await page.settle();
			page.asBackground(() => api["cycle"]!());
			await page.settle();
			expect(page.errors).toEqual([
				expect.objectContaining({
					code: "capture_too_deep",
					message: expect.stringMatching(
						/^The main-thread function of main-thread:ontap on <view> captures box, which holds itself[^\n]*\n.*CapturedOwnProxy\.svelte:\d+:\d+/,
					),
				}),
			]);
			page.asBackground(() => api["count"]!());
			await page.settle();
			expect(page.engine.texts()).toEqual(["count 1", "tap"]);
		});

		it("is reported once when it holds an element, and the function sent before stays", async () => {
			const { page, log, count } = failing(CapturedElement, drawCapturedElement, firstFrame);
			await page.settle();
			expect(page.errors).toEqual([
				expect.objectContaining({
					code: "element_in_main_thread_function",
					message: expect.stringMatching(
						/^The main-thread function of main-thread:ontap on <view> captures box, which holds the <view> element of the background[^\n]*\n.*CapturedElement\.svelte:\d+:\d+[\s\S]*main-thread:ref=\{ref\}/,
					),
				}),
			]);
			await count();
			expect(page.engine.texts()).toEqual(["count 1"]);
			await tap(page, "box");
			expect(log).toEqual(["tap null"]);
			expect(page.errors).toHaveLength(1);
		});
	},
);
