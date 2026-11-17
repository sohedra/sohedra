// Golden messages: representative patches and messages to the background, as the threads send
// them. Each is encoded, compared with its snapshot, and decoded back to the same value, so a change
// of the format is a deliberate diff here.

import { describe, expect, it } from "@rstest/core";

import {
	decodePatch,
	decodeToBackground,
	encodeCell,
	encodePatch,
	encodeToBackground,
	isCurrentPage,
	listUpdateInfo,
	OpCode,
	PROTOCOL_VERSION,
	ROOT_ID,
} from "../../../src/wire/index.ts";
import type { Op, PatchItem, ToBackground } from "../../../src/wire/index.ts";

/** A counter's elements: `<view class="counter" ontap={…}><text>Count: 0</text></view>`. */
const COUNTER: Op[] = [
	[OpCode.Create, 2, "view"],
	[OpCode.SetAttr, 2, "class", "counter"],
	[OpCode.SetEvent, 2, "bindEvent", "tap", 1],
	[OpCode.Create, 3, "text"],
	[OpCode.CreateText, 4, "Count: 0"],
	[OpCode.Insert, 3, 4, 0],
	[OpCode.Insert, 2, 3, 0],
	[OpCode.Insert, ROOT_ID, 2, 0],
];

/** A list of two rows, and a third inserted between them. */
const row = (id: number, key: string): Op[] => [
	[OpCode.Create, id, "list-item"],
	[OpCode.SetAttr, id, "item-key", key],
	[OpCode.CreateText, id + 1, key],
	[OpCode.Insert, id, id + 1, 0],
];
const infos = new Map([
	[10, { "item-key": "a" }],
	[20, { "item-key": "b" }],
	[30, { "item-key": "c" }],
]);
const LIST_INSERT: PatchItem[] = [
	["cell", 30, encodeCell(row(30, "c"))],
	[
		"ops",
		[
			[
				OpCode.ListUpdate,
				5,
				listUpdateInfo({ committed: [10, 20], items: [10, 30, 20], infos, changed: new Set() }),
				[10, 30, 20],
				[30],
				[],
			],
		],
	],
];

const PATCHES: [name: string, page: number, items: PatchItem[]][] = [
	["a counter's first patch", 0, [["ops", COUNTER]]],
	["a counter's update", 0, [["ops", [[OpCode.SetText, 4, "Count: 1"]]]]],
	["a list's insert", 0, LIST_INSERT],
	[
		"calls after the ops they depend on",
		0,
		[
			["ops", [[OpCode.SetAttr, 2, "class", "counter open"]]],
			["call", 1, 2, ["invoke", "boundingClientRect", {}]],
			["call", 2, 0, ["run", { _wkltId: "a1b2:open", _c: { to: 1 }, _execId: 3 }, [240]]],
			["reply", 1, { ok: true, value: "saved" }],
		],
	],
	["the reloaded page's first patch", 1, [["ops", COUNTER]]],
];

const MESSAGES: [name: string, message: ToBackground][] = [
	[
		"a tap",
		{
			t: "event",
			handler: 1,
			event: { type: "tap", timestamp: 1700, target: { id: "", uid: 21, dataset: {}, node: 2 } },
		},
	],
	[
		"a reply with a value",
		{ t: "reply", id: 1, result: { ok: true, value: { width: 120, height: 40 } } },
	],
	[
		"a reply with a thrown error",
		{
			t: "reply",
			id: 2,
			result: { ok: false, error: { name: "TypeError", message: "x is not a function" } },
		},
	],
	["a call of a background function", { t: "call", id: 1, fn: 2, context: 3, params: ["done"] }],
	["a release", { t: "release", contexts: [3] }],
];

describe("golden patches", () => {
	it.each(PATCHES)("%s", (_, page, items) => {
		const { data } = encodePatch({ page, items });
		expect(data).toMatchSnapshot();
		expect(decodePatch({ data })).toEqual({ v: PROTOCOL_VERSION, page, items });
	});

	it("drop the page before a reload", () => {
		const before = decodePatch(
			encodePatch({ page: 0, items: [["ops", [[OpCode.SetText, 4, "Count: 2"]]]] }),
		);
		expect(isCurrentPage(before, 1)).toBe(false);
	});
});

describe("golden messages to the background", () => {
	it.each(MESSAGES)("%s", (_, message) => {
		const event = encodeToBackground(message, 0);
		expect(event).toMatchSnapshot();
		expect(decodeToBackground(event)).toEqual({ ...message, v: PROTOCOL_VERSION, page: 0 });
	});
});
