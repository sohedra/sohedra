// Mistakes with main-thread functions, named in a development build: a plain function under a
// `main-thread:` attribute, which would bind nothing on either thread, Lynx's own spelling of an
// event through a spread, and an attribute that is no main-thread attribute. And one named in
// every build: a main-thread function that captures an element, which cannot be sent and is
// reported once, the page going on.

import { expect, it } from "@rstest/core";

import CapturedNode from "../../fixtures/threads/functions/CapturedNode.svelte";
import drawCapturedNode from "../../fixtures/threads/functions/CapturedNode.svelte?first-frame";
import Mistakes from "../../fixtures/threads/functions/Mistakes.svelte";
import drawMistakes from "../../fixtures/threads/functions/Mistakes.svelte?first-frame";
import { startFunctionsPage } from "./pages.ts";

it("names a plain function under a main-thread attribute, and an attribute that binds nothing", async () => {
	const page = startFunctionsPage(Mistakes, { draw: drawMistakes });
	await page.settle();
	expect(page.errors).toEqual([
		expect.objectContaining({
			code: "plain_function_under_main_thread",
			message: expect.stringMatching(
				/^The <view>'s main-thread:ontap is a plain function, so the main thread binds nothing[^\n]*\n.*Mistakes\.svelte:\d+:\d+/,
			),
		}),
		expect.objectContaining({
			code: "main_thread_event_spelling_removed",
			message: expect.stringMatching(
				/^The <view>'s main-thread:bindtap uses Lynx's own spelling of an event/,
			),
		}),
		expect.objectContaining({ code: "main_thread_attribute_unknown" }),
	]);
	expect(page.engine.state(page.byClass("plain")).mainThreadEvents).toEqual([]);
	// The first frame writes that spelling, so the main thread still binds it.
	expect(page.engine.state(page.byClass("removed")).mainThreadEvents).toHaveLength(1);
});

it("reports a captured element once, and goes on, in good time", async () => {
	const page = startFunctionsPage(CapturedNode, { draw: drawCapturedNode });
	await page.settle();
	expect(page.errors).toEqual([
		expect.objectContaining({
			code: "element_in_main_thread_function",
			message: expect.stringMatching(
				/^The main-thread function of main-thread:ontap on <view> captures the <view> element of the background, and an element cannot be sent to the main thread\./,
			),
		}),
	]);
	expect(page.engine.texts()).toEqual(["tap"]);
}, 10_000);
