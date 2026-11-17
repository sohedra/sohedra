// Every message carries the version of the format it is written in and the page its content
// belongs to. A receiver keeps a message of its own page and drops one of another, whatever its
// kind, except an error, which only reports. A development build reports a message of another
// version (the threads came from different builds) and one of a later page (the page reloaded on
// one thread only), which the engine's order never delivers otherwise.

import { describe, expect, it } from "@rstest/core";

import {
	checkMessage,
	decodePatch,
	decodeToBackground,
	encodeCall,
	encodePatch,
	encodeResult,
	encodeToBackground,
	keepsMessage,
	OpCode,
	PROTOCOL_VERSION,
} from "../../../src/wire/index.ts";
import type { Stamp, ToBackground } from "../../../src/wire/index.ts";

const FUNCTION = { _wkltId: "a1b2:onTap", _c: { count: 1 } };

type Received = Stamp & { t?: string };

const toBackground = (message: ToBackground) => (page: number) =>
	decodeToBackground(encodeToBackground(message, page));

/** One message of each kind that a receiver drops across pages, sent for `page` and received. */
const DROPPED: [kind: string, received: (page: number) => Received][] = [
	[
		"a patch",
		(page) => decodePatch(encodePatch({ page, items: [["ops", [[OpCode.SetText, 4, "1"]]]] })),
	],
	[
		"a patch with a call",
		(page) =>
			decodePatch(
				encodePatch({ page, items: [["call", 1, 0, encodeCall(["run", FUNCTION, []])]] }),
			),
	],
	[
		"a patch with a reply",
		(page) =>
			decodePatch(
				encodePatch({ page, items: [["reply", 1, encodeResult({ ok: true, value: 2 })]] }),
			),
	],
	["an event", toBackground({ t: "event", handler: 3, event: { type: "tap" } })],
	["a call", toBackground({ t: "call", id: 1, fn: 2, context: 3, params: [] })],
	["a reply", toBackground({ t: "reply", id: 1, result: { ok: true, value: null } })],
	["a release", toBackground({ t: "release", contexts: [4, 5] })],
];

const ERROR = toBackground({
	t: "error",
	error: { name: "TypeError", message: "x is not a function" },
});

const KINDS: [kind: string, received: (page: number) => Received][] = [
	...DROPPED,
	["an error", ERROR],
];

describe("the page a message belongs to", () => {
	it.each(KINDS)("%s of this page is kept", (_, received) => {
		expect(keepsMessage(received(3), 3)).toBe(true);
		expect(keepsMessage(received(0), 0)).toBe(true);
	});

	it.each(DROPPED)("%s of an earlier or a later page is dropped", (_, received) => {
		expect(keepsMessage(received(2), 3)).toBe(false);
		expect(keepsMessage(received(4), 3)).toBe(false);
	});

	it("keeps an error of any page: it runs nothing, and only reports", () => {
		expect(keepsMessage(ERROR(2), 3)).toBe(true);
		expect(keepsMessage(ERROR(4), 3)).toBe(true);
	});
});

describe("a reload, in the engine's order", () => {
	// The engine posts the reload to the background, then reloads the main thread in the same task,
	// so the main thread bumps first. What the main thread sends after its bump reaches the
	// background after the reload does, and the background bumps first thing when it gets it.
	it("drops the old page's work and keeps the new page's and every error", () => {
		let mainThread = 0;
		let background = 0;
		// The old app flushed a patch as the reload began: the main thread gets it after its bump.
		const late = decodePatch(
			encodePatch({ page: 0, items: [["ops", [[OpCode.Create, 50, "view"]]]] }),
		);
		mainThread++;
		expect(keepsMessage(late, mainThread)).toBe(false);
		// The main thread reports an error of the old page while it starts the new one over, and
		// sends the new first frame's tap.
		const error = ERROR(0);
		const tap = toBackground({ t: "event", handler: 1, event: { type: "tap" } })(mainThread);
		// A main-thread function of the old page answers its call after the reload.
		const reply = toBackground({ t: "reply", id: 7, result: { ok: true, value: 1 } })(0);
		background++;
		expect(keepsMessage(error, background)).toBe(true);
		expect(keepsMessage(tap, background)).toBe(true);
		expect(keepsMessage(reply, background)).toBe(false);
		// The new app's first patch.
		const first = decodePatch(encodePatch({ page: background, items: [["ops", []]] }));
		expect(keepsMessage(first, mainThread)).toBe(true);
	});
});

describe("a development build's check of a message", () => {
	it.each(KINDS)("passes %s of this page or an earlier one", (_, received) => {
		expect(received(0).v).toBe(PROTOCOL_VERSION);
		expect(() => checkMessage(received(3), { thread: "main-thread", page: 3 })).not.toThrow();
		expect(() => checkMessage(received(2), { thread: "background", page: 3 })).not.toThrow();
	});

	it.each(DROPPED)(
		"reports %s of a later page, as the page reloaded on one thread",
		(_, received) => {
			const thrown = catchError(() => checkMessage(received(4), { thread: "background", page: 3 }));
			expect(thrown.code).toBe("page_reloaded_on_one_thread");
			expect(thrown.message).toMatch(/^This page reloaded on one of its threads only\./);
			expect(thrown.message).toContain(
				"Seen on the background: it shows page 3 and got a message of page 4.",
			);
		},
	);

	it("does not report an error of a later page, which may come from the main thread's teardown", () => {
		expect(() => checkMessage(ERROR(4), { thread: "background", page: 3 })).not.toThrow();
	});

	it("reports another version, as threads from different builds", () => {
		const thrown = catchError(() =>
			checkMessage({ v: PROTOCOL_VERSION + 1, page: 0 }, { thread: "background", page: 0 }),
		);
		expect(thrown.code).toBe("threads_from_different_builds");
		expect(thrown.message).toMatch(
			/^This page's main thread and background thread come from different builds of the app\./,
		);
		expect(thrown.message).toContain(`version ${PROTOCOL_VERSION + 1}`);
		expect(thrown.message).toContain("the background");
	});
});

function catchError(run: () => void): Error & { code?: string } {
	try {
		run();
	} catch (error) {
		expect(error).toBeInstanceOf(Error);
		return error as Error & { code?: string };
	}
	throw new Error("It did not throw.");
}
