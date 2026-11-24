// What the main thread sends the background: an event for a handler, a main-thread function's call
// of a background function, the reply to a call of the patch, the function contexts it let go of,
// and an error it reported. Each is text, stamped with the version and the page, under one of two
// event types: what the background is asked to run, and what answers or reports back.

import { describe, expect, it } from "@rstest/core";

import {
	decodeToBackground,
	encodeError,
	encodeToBackground,
	OpCode,
	PROTOCOL_VERSION,
	TO_BACKGROUND,
} from "../../../src/wire/index.ts";
import type { ToBackground } from "../../../src/wire/index.ts";

const MESSAGES: [kind: string, message: ToBackground, type: string][] = [
	[
		"an event",
		{
			t: "event",
			handler: 3,
			event: {
				type: "tap",
				timestamp: 1700,
				detail: { x: 1, y: 2 },
				target: { id: "", uid: 12, dataset: { index: 0 }, element: 4 },
				currentTarget: { id: "row", uid: 11, dataset: {}, element: 3 },
			},
		},
		TO_BACKGROUND.events,
	],
	[
		"a call of a background function",
		{ t: "call", id: 1, fn: 2, context: 7, params: [{ x: 1 }] },
		TO_BACKGROUND.events,
	],
	[
		"a reply with a value",
		{ t: "reply", id: 4, result: { ok: true, value: { width: 10 } } },
		TO_BACKGROUND.replies,
	],
	[
		"a reply with a thrown error",
		{ t: "reply", id: 5, result: { ok: false, error: encodeError(new TypeError("no")) } },
		TO_BACKGROUND.replies,
	],
	["a release", { t: "release", contexts: [7, 8] }, TO_BACKGROUND.replies],
	[
		"an error",
		{
			t: "error",
			error: { name: "Error", message: "no UI for this node" },
			op: [OpCode.Insert, 1, 9, 0],
		},
		TO_BACKGROUND.replies,
	],
	[
		"an error with its code and where it was thrown",
		{
			t: "error",
			error: { name: "Error", message: "The first frame differs.", code: "hydration_mismatch" },
			place: { component: "src/Card.svelte", mainThreadFunction: "a1b2:onScroll" },
		},
		TO_BACKGROUND.replies,
	],
];

describe("a message to the background", () => {
	it.each(MESSAGES)("%s goes as text, under its event type", (_, message, type) => {
		const event = encodeToBackground(message, 2);
		expect(event.type).toBe(type);
		expect(typeof event.data).toBe("string");
	});

	it.each(MESSAGES)(
		"%s comes back as sent, stamped with the version and the page",
		(_, message) => {
			expect(decodeToBackground(encodeToBackground(message, 2))).toEqual({
				...message,
				v: PROTOCOL_VERSION,
				generation: 2,
			});
		},
	);

	it("fails when it is made if a value cannot cross, naming the background", () => {
		expect(() =>
			encodeToBackground({ t: "call", id: 1, fn: 2, context: 3, params: [1n] }, 0),
		).toThrow(/^A value sent to the background cannot be copied/);
	});

	it("has two event types, of the package's name", () => {
		expect(TO_BACKGROUND.events).not.toBe(TO_BACKGROUND.replies);
		for (const type of Object.values(TO_BACKGROUND)) expect(type).toMatch(/^@sohedra\/lynx:/);
	});
});
