// A component's top-level `on(root, "touchstart", …)`, which runs on the main thread as the first
// frame is drawn. Svelte's `on()` adds a touch listener a microtask later when no renderer is
// current, and Lynx's main thread has no global `queueMicrotask`: without the binding's, the call
// threw at once and the first frame was not drawn. Now the frame is drawn, and the microtask throws
// the error that names the call.

import { describe, expect, it } from "@rstest/core";

import TouchOnRoot from "../../fixtures/threads/page/TouchOnRoot.svelte";
import drawTouchOnRoot from "../../fixtures/threads/page/TouchOnRoot.svelte?first-frame";
import { startSveltePage } from "../svelte-page.ts";

describe("a touch listener on the root in a component's top-level code", () => {
	it("lets the first frame draw, and throws the main thread's error in the microtask after", async () => {
		// The engine reports a rejection the main thread left unhandled into Lynx; here the process
		// hears it, in place of the test runner, which would fail the file for it.
		const rejected: unknown[] = [];
		const onRejected = (reason: unknown) => void rejected.push(reason);
		const runners = process.listeners("unhandledRejection");
		process.removeAllListeners("unhandledRejection");
		process.on("unhandledRejection", onRejected);
		try {
			const page = startSveltePage(TouchOnRoot, { firstFrame: { draw: drawTouchOnRoot } });
			// Before the background answers: the main thread drew the frame.
			expect(page.engine.texts()).toEqual(["first frame"]);
			expect(page.errors).toEqual([]);
			await page.settle();
			// A rejection nobody handled is told when the event loop turns.
			await new Promise((resolve) => setTimeout(resolve, 10));
			expect(page.errors).toEqual([]);
			expect(page.engine.texts()).toEqual(["first frame"]);
		} finally {
			process.off("unhandledRejection", onRejected);
			for (const runner of runners) process.on("unhandledRejection", runner);
		}
		expect(rejected).toEqual([
			expect.objectContaining({
				code: "called_on_main_thread",
				message: expect.stringMatching(/^A call of on\(root, …\) ran on the main thread/),
			}),
		]);
	});
});
