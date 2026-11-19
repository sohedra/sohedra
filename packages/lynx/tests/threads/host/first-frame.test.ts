// `@sohedra/lynx/host` on the main thread, as components draw the first frame: each value is what
// the frame is drawn with, so the background's first render matches it.

import { describe, expect, it } from "@rstest/core";

import HostFrame from "../../fixtures/threads/host/HostFrame.svelte";
import drawHostFrame from "../../fixtures/threads/host/HostFrame.svelte?first-frame";
import { startSveltePage } from "../svelte-page.ts";

const info = { platform: "Android", pixelRatio: 2.75 };

function framed() {
	return startSveltePage(HostFrame, {
		initData: { title: "Inbox" },
		globalProps: { theme: "dark" },
		systemInfo: info,
		firstFrame: { draw: drawHostFrame },
	});
}

describe("the host's values in the first frame", () => {
	it("are what the frame is drawn with, the same as the background's", async () => {
		const page = framed();
		const drawn = page.engine.texts();
		expect(drawn).toEqual(["Inbox", "dark", "Android", "false 0"]);
		await page.settle();
		expect(page.engine.texts()).toEqual(drawn);
		expect(page.patches.flatMap((patch) => patch.items.map((item) => item[0]))).not.toContain(
			"rewrite",
		);
		expect(page.errors).toEqual([]);
	});

	it("show the merged data after a reload", async () => {
		const page = framed();
		await page.settle();
		page.reload({ title: "Reloaded" });
		await page.settle();
		expect(page.engine.texts()).toEqual(["Reloaded", "dark", "Android", "false 0"]);
	});
});
