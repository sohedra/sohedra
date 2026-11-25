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
import { readGlobal } from "../../src/testing/globals.ts";
import { startTestPage } from "../../src/testing/index.ts";
import {
	encodeCall,
	encodePatch,
	encodeToBackground,
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
