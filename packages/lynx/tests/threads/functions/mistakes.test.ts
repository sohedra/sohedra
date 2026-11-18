// Mistakes with main-thread functions, named in a development build: a plain function under a
// `main-thread:` attribute, which would bind nothing on either thread, and an attribute that is
// no main-thread attribute.

import { expect, it } from "@rstest/core";

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
		expect.objectContaining({ code: "main_thread_attribute_unknown" }),
	]);
	expect(page.engine.state(page.byClass("plain")).mainThreadEvents).toEqual([]);
});
