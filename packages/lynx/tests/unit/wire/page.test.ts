// Every message carries the version of the format it is written in and the page it belongs to. A
// message of another page is dropped in one place, whatever its kind; a message of another version
// means the two threads came from different builds, which development builds report.

import { describe, expect, it } from "@rstest/core";

import {
	checkVersion,
	decodePatch,
	decodeToBackground,
	encodePatch,
	encodeToBackground,
	isCurrentPage,
	OpCode,
	PROTOCOL_VERSION,
} from "../../../src/wire/index.ts";
import type { Stamp, ToBackground } from "../../../src/wire/index.ts";

const FUNCTION = { _wkltId: "a1b2:onTap", _c: { count: 1 } };

/** One message of each kind, sent for `page` and received back. */
const KINDS: [kind: string, received: (page: number) => Stamp][] = [
	[
		"a patch",
		(page) => decodePatch(encodePatch({ page, items: [["ops", [[OpCode.SetText, 4, "1"]]]] })),
	],
	[
		"a patch with a call",
		(page) => decodePatch(encodePatch({ page, items: [["call", 1, 0, ["run", FUNCTION, []]]] })),
	],
	[
		"a patch with a reply",
		(page) => decodePatch(encodePatch({ page, items: [["reply", 1, { ok: true, value: 2 }]] })),
	],
	...(
		[
			["an event", { t: "event", handler: 3, event: { type: "tap" } }],
			["a call", { t: "call", id: 1, fn: 2, context: 3, params: [] }],
			["a reply", { t: "reply", id: 1, result: { ok: true, value: null } }],
			["a release", { t: "release", contexts: [4, 5] }],
			["an error", { t: "error", error: { name: "TypeError", message: "x is not a function" } }],
		] satisfies [string, ToBackground][]
	).map(([kind, message]): [string, (page: number) => Stamp] => [
		kind,
		(page) => decodeToBackground(encodeToBackground(message, page)),
	]),
];

describe("the page a message belongs to", () => {
	it.each(KINDS)("%s of this page is taken", (_, received) => {
		expect(isCurrentPage(received(3), 3)).toBe(true);
		expect(isCurrentPage(received(0), 0)).toBe(true);
	});

	it.each(KINDS)("%s of an earlier or a later page is dropped", (_, received) => {
		expect(isCurrentPage(received(2), 3)).toBe(false);
		expect(isCurrentPage(received(4), 3)).toBe(false);
	});
});

describe("the version of the format", () => {
	it.each(KINDS)("%s carries it", (_, received) => {
		expect(received(0).v).toBe(PROTOCOL_VERSION);
		expect(() => checkVersion(received(0), "main-thread")).not.toThrow();
	});

	it("is another build's when it differs, which is an error with the message's code", () => {
		const other = { v: PROTOCOL_VERSION + 1, page: 0 };
		expect(() => checkVersion(other, "main-thread")).toThrow(
			"This page's main thread and background thread come from different builds of the app.",
		);
		let thrown: unknown;
		try {
			checkVersion(other, "background");
		} catch (error) {
			thrown = error;
		}
		expect(thrown).toBeInstanceOf(Error);
		expect((thrown as { code?: string }).code).toBe("threads_from_different_builds");
		expect((thrown as Error).message).toContain(`version ${PROTOCOL_VERSION + 1}`);
		expect((thrown as Error).message).toContain("the background");
	});
});
