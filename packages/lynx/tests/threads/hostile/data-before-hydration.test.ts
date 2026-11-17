// Data the host updates before hydration: the background renders its first patch from the data the
// first frame was drawn with, and applies the update after it, in order, as a patch of its own. An
// update never surfaces as the developer's `hydration_mismatch`.

import { describe, expect, it } from "@rstest/core";

import { startPage } from "../../../src/background/index.ts";
import { startMainThread } from "../../../src/main-thread/index.ts";
import { installGlobals, readGlobal } from "../../../src/testing/globals.ts";
import { startTestPage } from "../../../src/testing/index.ts";
import type { BackgroundLynx } from "../../../src/testing/index.ts";
import { FIRST_FRAME_GLOBAL } from "../../../src/wire/index.ts";
import FrameCounter from "../../fixtures/threads/FrameCounter.svelte";
import { startSveltePage } from "../svelte-page.ts";

const counter = (parity: string, padding = "24px"): string =>
	`<view class="root" style="padding: ${padding};"><text class="count">Taps: 0 (${parity})</text>` +
	`<view class="button"><text class="label">Tap me</text></view></view>`;

const flagged = (options: unknown): boolean =>
	(options as { triggerDataUpdated?: unknown } | undefined)?.triggerDataUpdated === true;

describe("data updated before hydration", () => {
	it("is applied after the first patch hydrates the frame, which it does not refuse", async () => {
		const page = startTestPage({
			initData: { parity: "drawn" },
			mainThread: () => {
				startMainThread();
				installGlobals({
					[FIRST_FRAME_GLOBAL]: (data: Record<string, unknown>) => counter(String(data["parity"])),
				});
			},
			background: () => {
				const lynx = readGlobal("lynx") as BackgroundLynx;
				lynx.getApp()._params = {
					initData: { parity: "drawn" },
					updateData: { parity: "updated" },
				};
				startPage(FrameCounter, { props: (data) => ({ parity: data["parity"] }) });
			},
		});
		const drawn = page.engine.all();
		await page.settle();
		expect(page.errors).toEqual([]);
		expect(page.engine.all()).toEqual(drawn);
		// The page's components rendered from the frame's data; the update came after.
		expect(page.engine.texts()).toEqual(["Taps: 0 (drawn)", "Tap me"]);
		expect(page.engine.flushes.filter(flagged)).toHaveLength(1);
		expect(page.lynx.background.__initData).toEqual({ parity: "updated" });
	});

	it("does not make the developer's mismatch of a frame that differs after an update", async () => {
		const page = startSveltePage(FrameCounter, { firstFrame: () => counter("even", "8px") });
		page.updateData({ theme: "dark" });
		await page.settle();
		expect(page.errors).toEqual([]);
		expect(page.engine.texts()).toEqual(["Taps: 0 (even)", "Tap me"]);
		expect(page.engine.state(page.byClass("root")).inlineStyles.get("padding")).toBe("24px");
	});
});
