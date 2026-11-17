// Patches that reach the main thread before the engine renders the page, when the page draws a
// first frame: they wait, the frame is drawn when the engine renders, and then they are applied in
// order, the first one hydrating the frame.

import { describe, expect, it } from "@rstest/core";

import { startMainThread } from "../../src/main-thread/index.ts";
import { installGlobals, readGlobal } from "../../src/testing/globals.ts";
import { startTestPage } from "../../src/testing/index.ts";
import {
	decodeToBackground,
	encodePatch,
	FIRST_FRAME_GLOBAL,
	OpCode,
	PATCH_METHOD,
	ROOT_ID,
	TO_BACKGROUND,
} from "../../src/wire/index.ts";
import type { Op, PatchParams } from "../../src/wire/index.ts";

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

describe("a patch that comes before the first frame", () => {
	it("waits, and hydrates the frame the engine's render draws, then the next applies", () => {
		const page = startTestPage({
			mainThread: () => {
				startMainThread();
				installGlobals({
					[FIRST_FRAME_GLOBAL]: () => `<view class="box"><text>drawn</text></view>`,
				});
				const patch = readGlobal(PATCH_METHOD) as (params: PatchParams) => void;
				patch(encodePatch({ page: 0, items: [["ops", FIRST]], rendered: 1 }));
				patch(encodePatch({ page: 0, items: [["ops", [[OpCode.SetText, 4, "changed"]]]] }));
			},
		});
		expect(page.errors).toEqual([]);
		expect(page.engine.texts()).toEqual(["changed"]);
		// Drawn once, then adopted: no element made twice.
		expect(page.engine.madeCount("view")).toBe(1);
		expect(page.engine.madeCount("raw-text")).toBe(1);
	});
});

describe("a rewrite item", () => {
	it("for anything but the page's root is reported, and leaves the page as it is", () => {
		const page = startTestPage({
			mainThread: () => {
				startMainThread();
				const patch = readGlobal(PATCH_METHOD) as (params: PatchParams) => void;
				patch(encodePatch({ page: 0, items: [["ops", FIRST]] }));
				patch(
					encodePatch({
						page: 0,
						items: [
							["rewrite", 2],
							["ops", [[OpCode.SetText, 4, "x"]]],
						],
					}),
				);
			},
		});
		expect(page.errors.map((error) => (error as { code?: string }).code)).toEqual([
			"rewrite_not_page",
		]);
		expect(page.engine.texts()).toEqual(["x"]);
		expect(page.engine.madeCount("view")).toBe(1);
	});
});

describe("a rewrite item for another element while the page waits to be written again", () => {
	it("asks for the page again, and the page that comes is shown", async () => {
		const asked: unknown[] = [];
		let patch: (params: PatchParams) => void = () => {};
		const page = startTestPage({
			mainThread: () => {
				startMainThread();
				// A frame the first patch refuses: a <text> where the patch makes a <view>.
				installGlobals({ [FIRST_FRAME_GLOBAL]: () => `<text class="box">drawn</text>` });
				patch = readGlobal(PATCH_METHOD) as (params: PatchParams) => void;
			},
		});
		page.asBackground(() =>
			page.lynx.background.getCoreContext().addEventListener(TO_BACKGROUND.replies, (event) => {
				const message = decodeToBackground(event);
				if (message.t === "rewrite") asked.push(message.nodes);
			}),
		);
		page.asMainThread(() => {
			patch(encodePatch({ page: 0, items: [["ops", FIRST]], rendered: 1 }));
			patch(encodePatch({ page: 0, items: [["rewrite", 2]] }));
		});
		await page.settle();
		expect(asked).toEqual([[ROOT_ID], [ROOT_ID]]);
		page.asMainThread(() =>
			patch(
				encodePatch({
					page: 0,
					items: [
						["rewrite", ROOT_ID],
						["ops", FIRST],
					],
				}),
			),
		);
		expect(page.engine.texts()).toEqual(["drawn"]);
		expect(page.engine.state(page.engine.all()[1]!).tag).toBe("view");
	});
});
