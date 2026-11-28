// The web's mapping of its native events onto core's event types.

import { describe, expect, it } from "vitest";

import { getInteractionEventType } from "#lib/foundation/kernel/index.js";

describe("getInteractionEventType", () => {
	it("passes on the native events core interprets under their own names", () => {
		for (const type of ["click", "mousedown", "keydown", "keyup", "mouseenter", "mousemove"]) {
			expect(getInteractionEventType(new Event(type))).toBe(type);
		}
	});

	it("maps any other native event to undefined", () => {
		for (const type of ["pointerdown", "touchstart", "touchend", "mouseleave", "focus", "tap"]) {
			expect(getInteractionEventType(new Event(type))).toBeUndefined();
		}
	});

	it("never yields core's imperative-action, which no native event is", () => {
		expect(getInteractionEventType(new Event("imperative-action"))).toBeUndefined();
	});
});
