// `keyboard` read in module-level code, before the page's entry calls `mountPage`: it listens from
// then on, and the page's start does not set it back to closed. One page in the file: the runtime
// has run none before it.

import { describe, expect, it } from "@rstest/core";

import { keyboard } from "../../../src/background/host-entry.ts";
import { mountPage } from "../../../src/background/index.ts";
import { startMainThread } from "../../../src/main-thread/index.ts";
import { startTestPage } from "../../../src/testing/index.ts";
import Counter from "../../fixtures/threads/Counter.svelte";
import { startUp } from "../svelte-page.ts";

describe("the keyboard read before the page starts", () => {
	it("keeps what it heard when the page starts", async () => {
		const page = startTestPage({
			mainThread: () => startMainThread(),
			background: () => {
				startUp();
				void keyboard.current;
			},
		});
		page.emitHostEvent("keyboardstatuschanged", ["on", 300]);
		await page.settle();
		page.asBackground(() => mountPage(Counter));
		await page.settle();
		expect(page.asBackground(() => keyboard.current)).toEqual({ open: true, height: 300 });
		expect(page.errors).toEqual([]);
	});
});
