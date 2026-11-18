// The background's channel: one rule for "the page is gone", and the main thread's messages of
// another page dropped.

import { describe, expect, it } from "@rstest/core";

import { openChannel } from "../../../src/background/channel.ts";
import { OpQueue } from "../../../src/background/renderer/queue.ts";
import { startMainThread } from "../../../src/main-thread/index.ts";
import { startTestPage } from "../../../src/testing/index.ts";
import { decodePatch, encodeToBackground, OpCode, ROOT_ID } from "../../../src/wire/index.ts";
import type { Patch, PatchParams, RewriteMessage, SentEvent } from "../../../src/wire/index.ts";

function channel() {
	const page = startTestPage({ mainThread: () => startMainThread() });
	const events: [number, SentEvent][] = [];
	const rewrites: RewriteMessage[] = [];
	const queue = new OpQueue();
	const opened = page.asBackground(() =>
		openChannel({
			queue,
			onEvent: (handler, event) => events.push([handler, event]),
			onRewrite: (message) => rewrites.push(message),
			tagOf: () => "view",
		}),
	);
	return { page, events, rewrites, queue, channel: opened };
}

/** What the channel sends, as the main thread receives it. */
function sentBy(page: ReturnType<typeof channel>["page"]): Patch[] {
	const sent: Patch[] = [];
	const native = page.lynx.background.getNativeApp();
	native.callLepusMethod = (_name, params) => void sent.push(decodePatch(params as PatchParams));
	return sent;
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

describe("hydration's part of the channel", () => {
	it("says how many of the first patch's items hold the page as it rendered", () => {
		const { page, queue, channel: opened } = channel();
		const sent = sentBy(page);
		page.asBackground(() => {
			queue.push([OpCode.Create, 2, "view"]);
			queue.push([OpCode.Insert, ROOT_ID, 2, 0]);
			opened.markRendered();
			queue.push([OpCode.SetAttr, 2, "class", "after"]);
			opened.flush();
			queue.push([OpCode.SetAttr, 2, "class", "later"]);
			opened.flush();
		});
		expect(sent.map((patch) => patch.rendered)).toEqual([1, undefined]);
		expect(sent[0]!.items).toHaveLength(2);
	});

	it("hands the main thread's rewrite message on", async () => {
		const { page, rewrites } = channel();
		page.asMainThread(() =>
			page.lynx.mainThread
				.getJSContext()
				.dispatchEvent(encodeToBackground({ t: "rewrite", nodes: [ROOT_ID] }, 0)),
		);
		await page.settle();
		expect(rewrites).toEqual([expect.objectContaining({ t: "rewrite", nodes: [ROOT_ID] })]);
	});

	it("writes the page again after what is queued, in a patch of its own that starts with the rewrite", () => {
		const { page, queue, channel: opened } = channel();
		const sent = sentBy(page);
		page.asBackground(() => {
			queue.push([OpCode.Create, 2, "view"]);
			queue.push([OpCode.Insert, ROOT_ID, 2, 0]);
			opened.rewritePage(() => {
				queue.push([OpCode.Create, 2, "view"]);
				queue.push([OpCode.Insert, ROOT_ID, 2, 0]);
			});
		});
		expect(sent.map((patch) => patch.items[0])).toEqual([
			[
				"ops",
				[
					[OpCode.Create, 2, "view"],
					[OpCode.Insert, ROOT_ID, 2, 0],
				],
			],
			["rewrite", ROOT_ID],
		]);
		expect(sent[1]!.items[1]).toEqual([
			"ops",
			[
				[OpCode.Create, 2, "view"],
				[OpCode.Insert, ROOT_ID, 2, 0],
			],
		]);
	});
});
