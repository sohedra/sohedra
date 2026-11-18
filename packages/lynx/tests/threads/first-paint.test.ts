// The first paint before hydration: a first patch that reaches the main thread before the platform
// has painted the first frame waits for the paint, then hydrates the frame. A patch that comes
// after the paint applies at once.

import { afterEach, describe, expect, it, rs } from "@rstest/core";

import { startMainThread } from "../../src/main-thread/index.ts";
import { installGlobals, readGlobal } from "../../src/testing/globals.ts";
import { startTestPage } from "../../src/testing/index.ts";
import {
	encodePatch,
	FIRST_FRAME_GLOBAL,
	OpCode,
	PATCH_METHOD,
	ROOT_ID,
} from "../../src/wire/index.ts";
import type { Op, PatchParams } from "../../src/wire/index.ts";
import FrameCounter from "../fixtures/threads/FrameCounter.svelte";
import drawFrameCounter from "../fixtures/threads/FrameCounter.svelte?first-frame";
import { startSveltePage } from "./svelte-page.ts";

afterEach(() => {
	rs.useRealTimers();
});

/** The counter page: its first frame says `drawn`, and the background's page `patched`. */
function counter() {
	return startSveltePage(FrameCounter, {
		props: () => ({ parity: "patched" }),
		firstFrame: { draw: drawFrameCounter, props: { parity: "drawn" } },
	});
}

/** The background's first patch of `<view class="box"><text>{text}</text></view>`. */
const FIRST: Op[] = [
	[OpCode.Create, 2, "view"],
	[OpCode.SetAttr, 2, "class", "box"],
	[OpCode.Create, 3, "text"],
	[OpCode.CreateText, 4, "drawn"],
	[OpCode.Insert, 3, 4, 0],
	[OpCode.Insert, 2, 3, 0],
	[OpCode.Insert, ROOT_ID, 2, 0],
];

/** The page's patch function, as the background calls it. */
const patchMethod = () => readGlobal(PATCH_METHOD) as (params: PatchParams) => void;

describe("a first patch that comes before the first paint", () => {
	it("waits for the platform to paint the first frame, then hydrates it", async () => {
		const page = counter();
		const frames = page.engine.holdFrames();
		await page.settle();
		expect(page.patches).toHaveLength(1);
		expect(page.engine.texts()[0]).toBe("Taps: 0 (drawn)");
		const seen: string[] = [];
		page.engine.functions.requestAnimationFrame(() => seen.push(page.engine.texts()[0]!));
		frames();
		await page.settle();
		// The frame after the render still shows the first frame, and paints it; the patch applies
		// at the frame after that.
		expect(seen).toEqual(["Taps: 0 (drawn)"]);
		expect(page.engine.texts()[0]).toBe("Taps: 0 (patched)");
		expect(page.errors).toEqual([]);
	});

	it("waits even when it came before the render, and the patches after it follow in order", async () => {
		const seen: string[] = [];
		const page = startTestPage({
			mainThread: () => {
				startMainThread();
				installGlobals({
					[FIRST_FRAME_GLOBAL]: () => `<view class="box"><text>drawn</text></view>`,
				});
				const patch = patchMethod();
				patch(encodePatch({ page: 0, items: [["ops", FIRST]], rendered: 1 }));
				patch(encodePatch({ page: 0, items: [["ops", [[OpCode.SetText, 4, "changed"]]]] }));
				const frame = readGlobal("requestAnimationFrame") as (callback: () => void) => number;
				frame(() => seen.push(...page.engine.texts()));
			},
		});
		expect(page.engine.texts()).toEqual(["drawn"]);
		await page.settle();
		expect(seen).toEqual(["drawn"]);
		expect(page.engine.texts()).toEqual(["changed"]);
		// Drawn once, then adopted.
		expect(page.engine.madeCount("view")).toBe(1);
		expect(page.errors).toEqual([]);
	});

	it("applies within a second when no frame comes", async () => {
		rs.useFakeTimers();
		const page = counter();
		const frames = page.engine.holdFrames();
		await page.settle();
		expect(page.engine.texts()[0]).toBe("Taps: 0 (drawn)");
		rs.advanceTimersByTime(1000);
		await page.settle();
		expect(page.engine.texts()[0]).toBe("Taps: 0 (patched)");
		frames();
		await page.settle();
		expect(page.engine.texts()[0]).toBe("Taps: 0 (patched)");
		expect(page.errors).toEqual([]);
	});

	it("waits for its frame when the timer fires late, behind work that kept the thread busy", async () => {
		rs.useFakeTimers();
		const page = counter();
		const frames = page.engine.holdFrames();
		await page.settle();
		// The timer comes due long after its time: the frame waiting behind the same work is next.
		rs.setSystemTime(Date.now() + 2000);
		rs.advanceTimersByTime(500);
		await page.settle();
		expect(page.engine.texts()[0]).toBe("Taps: 0 (drawn)");
		frames();
		await page.settle();
		expect(page.engine.texts()[0]).toBe("Taps: 0 (patched)");
		expect(page.errors).toEqual([]);
	});

	it("applies after a few late timers when no frame comes", async () => {
		rs.useFakeTimers();
		const page = counter();
		page.engine.holdFrames();
		await page.settle();
		let late = 0;
		while (page.engine.texts()[0] === "Taps: 0 (drawn)" && late < 100) {
			rs.setSystemTime(Date.now() + 2000);
			rs.advanceTimersByTime(500);
			await page.settle();
			late++;
		}
		expect(late).toBeGreaterThan(1);
		expect(late).toBeLessThan(100);
		expect(page.engine.texts()[0]).toBe("Taps: 0 (patched)");
		expect(page.errors).toEqual([]);
	});

	it("applies at once on a host whose main thread has no timers, which is reported", async () => {
		const page = startTestPage({
			mainThread: () => {
				startMainThread();
				installGlobals({
					[FIRST_FRAME_GLOBAL]: () => `<view class="box"><text>drawn</text></view>`,
				});
				const lynx = readGlobal("lynx") as { setTimeout: () => number };
				lynx.setTimeout = () => {
					throw new Error("no timers");
				};
				const patch = patchMethod();
				patch(encodePatch({ page: 0, items: [["ops", FIRST]], rendered: 1 }));
				patch(encodePatch({ page: 0, items: [["ops", [[OpCode.SetText, 4, "changed"]]]] }));
			},
		});
		await page.settle();
		expect(page.engine.texts()).toEqual(["changed"]);
		expect(page.errors.map((error) => (error as Error).message)).toEqual(["no timers"]);
	});

	it("hydrates when clearing its timer throws, which is reported", async () => {
		const page = counter();
		page.lynx.mainThread.clearTimeout = () => {
			throw new Error("no clearing");
		};
		await page.settle();
		expect(page.engine.texts()[0]).toBe("Taps: 0 (patched)");
		expect(page.errors.map((error) => (error as Error).message)).toEqual(["no clearing"]);
	});
});

describe("a first patch that comes after the first paint", () => {
	it("applies at once", async () => {
		const page = startTestPage({
			mainThread: () => {
				startMainThread();
				installGlobals({
					[FIRST_FRAME_GLOBAL]: () => `<view class="box"><text>drawn</text></view>`,
				});
			},
		});
		await page.settle();
		page.asMainThread(() => {
			const patch = patchMethod();
			patch(
				encodePatch({
					page: 0,
					items: [
						["ops", FIRST],
						["ops", [[OpCode.SetText, 4, "changed"]]],
					],
					rendered: 1,
				}),
			);
		});
		expect(page.engine.texts()).toEqual(["changed"]);
		expect(page.engine.madeCount("view")).toBe(1);
		expect(page.errors).toEqual([]);
	});
});
