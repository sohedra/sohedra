// A first frame that cannot be drawn: the page's markup throws while it renders, cannot be read,
// or the engine fails while it is drawn. The error is reported into Lynx from the main thread,
// nothing of the frame stays, and the background's first patch makes the page.

import { describe, expect, it } from "@rstest/core";

import type { ElementFunctions } from "../../src/testing/engine/create-engine.ts";
import FrameCounter from "../fixtures/threads/FrameCounter.svelte";
import { startSveltePage } from "./svelte-page.ts";

const MARKUP = `<view class="root" style="padding: 24px;"><text class="count">Taps: 0 (even)</text><view class="button"><text class="label">Tap me</text></view></view>`;

describe("a first frame that cannot be drawn", () => {
	it("whose render throws is reported, and the background makes the page", async () => {
		const page = startSveltePage(FrameCounter, {
			firstFrame: () => {
				throw new Error("the component threw");
			},
		});
		expect(page.engine.all()).toHaveLength(1);
		await page.settle();
		expect(page.errors.map(String)).toEqual(["Error: the component threw"]);
		expect(page.engine.texts()).toEqual(["Taps: 0 (even)", "Tap me"]);
	});

	it("whose markup cannot be read says where", async () => {
		const page = startSveltePage(FrameCounter, { firstFrame: () => `<view class=root></view>` });
		await page.settle();
		expect(page.errors.map((error) => (error as Error).message)).toMatchSnapshot();
		expect(page.engine.texts()).toEqual(["Taps: 0 (even)", "Tap me"]);
	});

	it("that the engine fails to draw leaves nothing of it", async () => {
		const page = startSveltePage(FrameCounter, {
			firstFrame: () => {
				// The engine's functions are the main thread's globals while it draws.
				const scope = globalThis as unknown as ElementFunctions;
				const setClasses = scope.__SetClasses;
				let calls = 0;
				scope.__SetClasses = (element, classes) => {
					if (++calls === 2) throw new Error("the engine failed");
					setClasses(element, classes);
				};
				return MARKUP;
			},
		});
		const drawn = page.engine.all().slice(1);
		await page.settle();
		expect(page.errors.map(String)).toEqual(["Error: the engine failed"]);
		expect(page.engine.all().filter((element) => drawn.includes(element))).toEqual([]);
		expect(page.engine.texts()).toEqual(["Taps: 0 (even)", "Tap me"]);
	});
});
