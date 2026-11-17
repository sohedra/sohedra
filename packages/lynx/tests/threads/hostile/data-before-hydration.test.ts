// Data the host gives the page before it loads: Lynx draws the first frame from the template's data
// with the host's over it, and gives the background both, as `_params.initData` and
// `_params.updateData` (core/runtime/js/bindings/js_app.cc). The background renders its first patch
// from the same, so the frame is hydrated, and nothing is an update. Data the host updates later is
// one; a mismatch is still reported while it is on its way.

import { describe, expect, it } from "@rstest/core";

import { startPage } from "../../../src/background/index.ts";
import { startMainThread } from "../../../src/main-thread/index.ts";
import { installGlobals } from "../../../src/testing/globals.ts";
import { startTestPage } from "../../../src/testing/index.ts";
import { FIRST_FRAME_GLOBAL } from "../../../src/wire/index.ts";
import FrameCounter from "../../fixtures/threads/FrameCounter.svelte";
import { startSveltePage } from "../svelte-page.ts";

const counter = (parity: string, padding = "24px"): string =>
	`<view class="root" style="padding: ${padding};"><text class="count">Taps: 0 (${parity})</text>` +
	`<view class="button"><text class="label">Tap me</text></view></view>`;

const flagged = (options: unknown): boolean =>
	(options as { triggerDataUpdated?: unknown } | undefined)?.triggerDataUpdated === true;

describe("data the host gives before the page loads", () => {
	it("is in the background's first patch, which hydrates the frame drawn with it", async () => {
		const page = startTestPage({
			templateData: { parity: "template" },
			initData: { parity: "host" },
			mainThread: () => {
				startMainThread();
				installGlobals({
					[FIRST_FRAME_GLOBAL]: (data: Record<string, unknown>) => counter(String(data["parity"])),
				});
			},
			background: () => {
				startPage(FrameCounter, { props: (data) => ({ parity: data["parity"] }) });
			},
		});
		const drawn = page.engine.all();
		expect(page.engine.texts()).toEqual(["Taps: 0 (host)", "Tap me"]);
		await page.settle();
		expect(page.errors).toEqual([]);
		expect(page.engine.all()).toEqual(drawn);
		expect(page.engine.texts()).toEqual(["Taps: 0 (host)", "Tap me"]);
		expect(page.engine.flushes.filter(flagged)).toHaveLength(0);
		expect(page.lynx.background.__initData).toEqual({ parity: "host" });
	});
});

describe("data the host updates before hydration", () => {
	it("does not hide a mismatch of the frame", async () => {
		const page = startSveltePage(FrameCounter, { firstFrame: () => counter("even", "8px") });
		page.updateData({ theme: "dark" });
		await page.settle();
		expect(page.errors.map((error) => (error as { code?: string }).code)).toEqual([
			"hydration_mismatch",
		]);
		expect(page.engine.state(page.byClass("root")).inlineStyles.get("padding")).toBe("24px");
	});
});
