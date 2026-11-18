// The background's channel: one rule for "the page is gone", and the main thread's messages of
// another page dropped.

import { describe, expect, it } from "@rstest/core";

import { openChannel } from "../../../src/background/channel.ts";
import { OpQueue } from "../../../src/background/renderer/queue.ts";
import { startMainThread } from "../../../src/main-thread/index.ts";
import { startTestPage } from "../../../src/testing/index.ts";
import { encodeToBackground } from "../../../src/wire/index.ts";
import type { SentEvent } from "../../../src/wire/index.ts";

function channel() {
	const page = startTestPage({ mainThread: () => startMainThread() });
	const events: [number, SentEvent][] = [];
	const opened = page.asBackground(() =>
		openChannel({
			queue: new OpQueue(),
			onEvent: (handler, event) => events.push([handler, event]),
			tagOf: () => "view",
		}),
	);
	return { page, events, channel: opened };
}

const gone = expect.objectContaining({
	code: "page_is_gone",
	message: expect.stringMatching(/^A call of scrollTo has no answer: the page it was made on/),
});

describe("a call of the main thread", () => {
	it("rejects with the page_is_gone code when the page is bumped before its answer", async () => {
		const { page, channel: opened } = channel();
		const call = opened.call(0, ["invoke", "scrollTo", {}]);
		page.asBackground(() => opened.abandon());
		await expect(call).rejects.toEqual(gone);
		await page.settle();
	});

	it("rejects with the same error when the page is destroyed before its answer, or was already", async () => {
		const { page, channel: opened } = channel();
		const inFlight = opened.call(0, ["invoke", "scrollTo", {}]);
		page.asBackground(() => opened.close());
		await expect(inFlight).rejects.toEqual(gone);
		await expect(opened.call(0, ["invoke", "scrollTo", {}])).rejects.toEqual(gone);
	});

	it("rejects with what the main thread answered when it cannot be made", async () => {
		const { page, channel: opened } = channel();
		const call = expect(opened.call(42, ["invoke", "scrollTo", {}])).rejects.toMatchObject({
			code: "element_missing",
			message: expect.stringMatching(/^The main thread has no element 42\.\n/),
		});
		await page.settle();
		await call;
	});

	it("fails at once when its arguments cannot be copied", async () => {
		const { channel: opened } = channel();
		await expect(opened.call(0, ["invoke", "scrollTo", { n: 1n }])).rejects.toMatchObject({
			code: "value_not_copyable",
		});
	});
});

describe("a message from the main thread", () => {
	it("of the page shown runs its handler; one of another page is dropped", async () => {
		const { page, events } = channel();
		const context = page.lynx.mainThread.getJSContext();
		context.dispatchEvent(
			encodeToBackground({ t: "event", handler: 3, event: { type: "tap" } }, 0),
		);
		context.dispatchEvent(
			encodeToBackground({ t: "event", handler: 4, event: { type: "tap" } }, 7),
		);
		await page.settle();
		expect(events.map(([handler]) => handler)).toEqual([3]);
		// A later page means one thread reloaded alone: reported in development.
		expect(page.errors).toEqual([expect.objectContaining({ code: "page_reloaded_on_one_thread" })]);
	});
});
