// A value under `main-thread:gesture` that is no gesture sets nothing, and a development build
// says so once per place, naming what it is.

import { describe, expect, it } from "@rstest/core";

import NotGestures from "../../fixtures/threads/gestures/NotGestures.svelte";
import drawNotGestures from "../../fixtures/threads/gestures/NotGestures.svelte?first-frame";
import { startFunctionsPage } from "../functions/pages.ts";

describe("a value that is no gesture", () => {
	it("sets no detector and no view of its own, and a development build names it", async () => {
		const page = startFunctionsPage(NotGestures, { draw: drawNotGestures });
		await page.settle();
		for (const token of ["object", "list", "plain"]) {
			expect(page.engine.detectors(page.byClass(token)), token).toEqual([]);
			expect(page.engine.state(page.byClass(token)).attrs, token).toEqual({});
		}
		expect(page.errors).toEqual(
			["an object", "a list", "a function"].map((value) =>
				expect.objectContaining({
					code: "main_thread_gesture_not_a_gesture",
					message: expect.stringMatching(
						new RegExp(`^The <view>'s main-thread:gesture is ${value}, not a gesture`),
					),
				}),
			),
		);
	});
});
