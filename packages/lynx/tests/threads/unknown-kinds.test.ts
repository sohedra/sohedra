// A message between the threads, or a part of one, of a kind this build does not know: a
// development build reports it once with its code, and each thread goes on with the rest. A
// production build skips it (./unknown-kinds-production.test.ts).

import { describe, expect, it } from "@rstest/core";

import { openChannel } from "../../src/background/channel.ts";
import { OpQueue } from "../../src/background/renderer/queue.ts";
import { startMainThread } from "../../src/main-thread/index.ts";
import { installGlobals, readGlobal } from "../../src/testing/globals.ts";
import { startTestPage } from "../../src/testing/index.ts";
import {
	encodeCall,
	encodePatch,
	encodeToBackground,
	FIRST_FRAME_GLOBAL,
	OpCode,
	PATCH_METHOD,
	ROOT_ID,
} from "../../src/wire/index.ts";
import type {
	CallRequest,
	Op,
	PatchItem,
	PatchParams,
	SentEvent,
	ToBackground,
} from "../../src/wire/index.ts";

// Boundary: each is a kind no reader has, as another build could send it.
const UNKNOWN_ITEM = ["mystery", 1] as unknown as PatchItem;
const UNKNOWN_OP = [99, 2] as unknown as Op;
const UNKNOWN_CALL = ["mystery"] as unknown as CallRequest;
const UNKNOWN_MESSAGE = { t: "mystery" } as unknown as ToBackground;

const unknownKind = (kind: string, received: string) =>
	expect.objectContaining({
		code: "message_kind_unknown",
		message: expect.stringContaining(`does not know (${kind}).\nSeen on ${received}.`),
	});

/** The background's first patch of `<view class="box"></view>`. */
const BOX: Op[] = [
	[OpCode.Create, 2, "view"],
	[OpCode.SetAttr, 2, "class", "box"],
	[OpCode.Insert, ROOT_ID, 2, 0],
];

/** A test page's main thread, with a first frame when `frame` is given, and its patch function. */
function mainThreadPage(frame?: string) {
	let patch: (params: PatchParams) => void = () => {};
	const page = startTestPage({
		mainThread: () => {
			startMainThread();
			if (frame !== undefined) installGlobals({ [FIRST_FRAME_GLOBAL]: () => frame });
			patch = readGlobal(PATCH_METHOD) as (params: PatchParams) => void;
		},
	});
	const apply = (items: PatchItem[], rendered?: number): void =>
		page.asMainThread(() => patch(encodePatch({ generation: 0, items, rendered })));
	return { page, apply };
}

describe("the main thread, in a development build", () => {
	it("reports an item of a kind it does not know, and applies the rest", () => {
		const { page, apply } = mainThreadPage();
		apply([
			UNKNOWN_ITEM,
			[
				"ops",
				[
					[OpCode.Create, 2, "view"],
					[OpCode.Insert, ROOT_ID, 2, 0],
				],
			],
		]);
		expect(page.engine.all().map((element) => page.engine.state(element).tag)).toEqual([
			"page",
			"view",
		]);
		expect(page.errors).toEqual([unknownKind("mystery", "the main thread")]);
	});

	it("reports an op of a kind it does not know, and applies the rest", () => {
		const { page, apply } = mainThreadPage();
		apply([["ops", [[OpCode.Create, 2, "view"], UNKNOWN_OP, [OpCode.Insert, ROOT_ID, 2, 0]]]]);
		expect(page.engine.all()).toHaveLength(2);
		expect(page.errors).toEqual([unknownKind("99", "the main thread")]);
	});

	it("reports a call of a kind it does not know", () => {
		const { page, apply } = mainThreadPage();
		apply([
			["ops", [[OpCode.Create, 2, "view"]]],
			["call", 0, 2, encodeCall(UNKNOWN_CALL)],
		]);
		expect(page.errors).toEqual([unknownKind("mystery", "the main thread")]);
	});
});

describe("the main thread with a first frame, in a development build", () => {
	it("reports an op of a kind it does not know in the rendered page, and asks for the page again", async () => {
		const { page, apply } = mainThreadPage(`<view class="box"></view>`);
		apply([["ops", [...BOX, UNKNOWN_OP]]], 1);
		await page.settle();
		expect(page.errors).toEqual([unknownKind("99", "the main thread")]);
	});

	it("reports an item of a kind it does not know while the page waits to be written again", async () => {
		// A frame the first patch refuses: a <text> where the patch makes a <view>.
		const { page, apply } = mainThreadPage(`<text class="box"></text>`);
		apply([["ops", BOX]], 1);
		await page.settle();
		apply([UNKNOWN_ITEM, ["rewrite", ROOT_ID], ["ops", BOX]]);
		await page.settle();
		expect(page.errors).toEqual([unknownKind("mystery", "the main thread")]);
		expect(page.engine.all().map((element) => page.engine.state(element).tag)).toEqual([
			"page",
			"view",
		]);
	});
});

describe("the background, in a development build", () => {
	it("reports a message of a kind it does not know, and hears the next", async () => {
		const page = startTestPage({ mainThread: () => startMainThread() });
		const events: SentEvent[] = [];
		page.asBackground(() =>
			openChannel({
				queue: new OpQueue(),
				onEvent: (_handler, event) => events.push(event),
				onRewrite: () => {},
				onPropsIds: () => {},
				tagOf: () => "view",
			}),
		);
		const context = page.lynx.mainThread.getJSContext();
		page.asMainThread(() => {
			context.dispatchEvent(encodeToBackground(UNKNOWN_MESSAGE, 0));
			context.dispatchEvent(
				encodeToBackground({ t: "event", handler: 3, event: { type: "tap" } }, 0),
			);
		});
		await page.settle();
		expect(events).toEqual([{ type: "tap" }]);
		expect(page.errors).toEqual([unknownKind("mystery", "the background")]);
	});
});
