// A production build skips a message between the threads, or a part of one, of a kind it does not
// know, and says nothing: both threads ship in one build. A development build reports it
// (./unknown-kinds.test.ts).

import { describe, expect, it, rs } from "@rstest/core";

import * as backgroundGlobals from "../../src/background/globals.ts" with {
	rstest: "importActual",
};
import * as mainThreadGlobals from "../../src/main-thread/globals.ts" with {
	rstest: "importActual",
};
import { installGlobals, readGlobal } from "../../src/testing/globals.ts";
import { startTestPage } from "../../src/testing/index.ts";
import {
	decodeToBackground,
	encodeCall,
	encodePatch,
	encodeToBackground,
	FIRST_FRAME_GLOBAL,
	OpCode,
	PATCH_METHOD,
	ROOT_ID,
	TO_BACKGROUND,
} from "../../src/wire/index.ts";
import type {
	CallRequest,
	Op,
	PatchItem,
	PatchParams,
	SentEvent,
	ToBackground,
} from "../../src/wire/index.ts";

rs.mock("../../src/background/globals.ts", () => ({ ...backgroundGlobals, DEV: false }));
rs.mock("../../src/main-thread/globals.ts", () => ({ ...mainThreadGlobals, DEV: false }));

const { openChannel } = await import("../../src/background/channel.ts");
const { OpQueue } = await import("../../src/background/renderer/queue.ts");
const { startMainThread } = await import("../../src/main-thread/index.ts");

// Boundary: each is a kind no reader has, as another build could send it.
const UNKNOWN_ITEM = ["mystery", 1] as unknown as PatchItem;
const UNKNOWN_OP = [99, 2] as unknown as Op;
const UNKNOWN_CALL = ["mystery"] as unknown as CallRequest;
const UNKNOWN_MESSAGE = { t: "mystery" } as unknown as ToBackground;

describe("the main thread, in a production build", () => {
	it("skips an item, an op and a call of a kind it does not know, and applies the rest", () => {
		const page = startTestPage({ mainThread: () => startMainThread() });
		const patch = readGlobal(PATCH_METHOD) as (params: PatchParams) => void;
		page.asMainThread(() =>
			patch(
				encodePatch({
					generation: 0,
					items: [
						UNKNOWN_ITEM,
						["ops", [[OpCode.Create, 2, "view"], UNKNOWN_OP, [OpCode.Insert, ROOT_ID, 2, 0]]],
						["call", 0, 2, encodeCall(UNKNOWN_CALL)],
					],
				}),
			),
		);
		expect(page.engine.all().map((element) => page.engine.state(element).tag)).toEqual([
			"page",
			"view",
		]);
		expect(page.errors).toEqual([]);
	});
});

/** The background's first patch of `<view class="box"></view>`. */
const BOX: Op[] = [
	[OpCode.Create, 2, "view"],
	[OpCode.SetAttr, 2, "class", "box"],
	[OpCode.Insert, ROOT_ID, 2, 0],
];

/** A test page's main thread with a first frame, and a way to send it a patch. */
function framedPage(frame: string) {
	let patch: (params: PatchParams) => void = () => {};
	const page = startTestPage({
		mainThread: () => {
			startMainThread();
			installGlobals({ [FIRST_FRAME_GLOBAL]: () => frame });
			patch = readGlobal(PATCH_METHOD) as (params: PatchParams) => void;
		},
	});
	const apply = (items: PatchItem[], rendered?: number): void =>
		page.asMainThread(() => patch(encodePatch({ generation: 0, items, rendered })));
	/** The elements each rewrite message asked the background to write again. */
	const asked: number[][] = [];
	page.asBackground(() =>
		page.lynx.background.getCoreContext().addEventListener(TO_BACKGROUND.replies, (event) => {
			const message = decodeToBackground(event);
			if (message.t === "rewrite") asked.push(message.elements);
		}),
	);
	return { page, apply, asked };
}

describe("the main thread with a first frame, in a production build", () => {
	it("skips an op of a kind it does not know in the rendered page, and hydrates the frame", async () => {
		const { page, apply, asked } = framedPage(`<view class="box"></view>`);
		apply([["ops", [...BOX, UNKNOWN_OP]]], 1);
		await page.settle();
		expect(page.errors).toEqual([]);
		// Adopted: the page is not asked for again, and the frame's view is the page's.
		expect(asked).toEqual([]);
		expect(page.engine.madeCount("view")).toBe(1);
	});

	it("skips an item of a kind it does not know while the page waits to be written again", async () => {
		// A frame the first patch refuses: a <text> where the patch makes a <view>.
		const { page, apply } = framedPage(`<text class="box"></text>`);
		apply([["ops", BOX]], 1);
		await page.settle();
		apply([UNKNOWN_ITEM, ["rewrite", ROOT_ID], ["ops", BOX]]);
		await page.settle();
		expect(page.errors).toEqual([]);
		expect(page.engine.all().map((element) => page.engine.state(element).tag)).toEqual([
			"page",
			"view",
		]);
	});
});

describe("the background, in a production build", () => {
	it("skips a message of a kind it does not know, and hears the next", async () => {
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
		expect(page.errors).toEqual([]);
	});
});
