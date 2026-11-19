// A main-thread function declaration whose `runOnBackground` hands on a `const` declared above it:
// its object holds the handle, so the object is made where the function is written, not at the
// top of the component, before the `const` is set.

import { expect, it } from "@rstest/core";

import HandsConstToBackground from "../../fixtures/threads/functions/HandsConstToBackground.svelte";
import drawHandsConstToBackground from "../../fixtures/threads/functions/HandsConstToBackground.svelte?first-frame";
import { startFunctionsPage, tap } from "../functions/pages.ts";

it("mounts, and the call reaches the background function", async () => {
	const log: unknown[] = [];
	const page = startFunctionsPage(HandsConstToBackground, {
		draw: drawHandsConstToBackground,
		props: { log },
	});
	await page.settle();
	expect(page.errors).toEqual([]);
	await tap(page, "tap");
	expect(page.errors).toEqual([]);
	expect(log).toEqual(["sum 3"]);
});
