// How the web reads its native events for core: their interaction type, their pointer type, and
// whether a pointerdown comes from a screen reader rather than a real pointer.
import { describe, expect, it, vi } from "vitest";

import {
	getInteractionEventType,
	getPointerType,
	isVirtualPointerEvent,
	userAgent,
} from "#lib/foundation/kernel/index.js";
import type * as UserAgentModule from "#lib/foundation/kernel/kernel-user-agent.js";

// The platform flags with Android off; the Android case turns it on for itself.
vi.mock("#lib/foundation/kernel/kernel-user-agent.js", async (importOriginal) => {
	const actual = await importOriginal<typeof UserAgentModule>();
	return {
		...actual,
		userAgent: { ...actual.userAgent, os: { ...actual.userAgent.os, android: false } },
	};
});

/** The pointerdown of a screen reader's press: no size, no pressure, no click count. */
function pointerEvent(overrides: Partial<PointerEvent>): PointerEvent {
	return {
		type: "pointerdown",
		width: 1,
		height: 1,
		pressure: 0,
		detail: 0,
		buttons: 0,
		pointerType: "mouse",
		...overrides,
	} as PointerEvent;
}

describe("getInteractionEventType", () => {
	it.each(["click", "mousedown", "keydown", "keyup", "mouseenter", "mousemove"])(
		"passes on the native %s event under its own name",
		(type) => {
			expect(getInteractionEventType(new Event(type))).toBe(type);
		},
	);

	it.each(["pointerdown", "touchstart", "touchend", "mouseleave", "focus", "tap"])(
		"maps the native %s event to undefined",
		(type) => {
			expect(getInteractionEventType(new Event(type))).toBeUndefined();
		},
	);

	it("never yields core's imperative-action, which no native event is", () => {
		expect(getInteractionEventType(new Event("imperative-action"))).toBeUndefined();
	});
});

describe("getPointerType", () => {
	it.each([
		{ name: "mouse", pointerType: "mouse" },
		{ name: "pen", pointerType: "pen" },
		{ name: "touch", pointerType: "touch" },
		{ name: "empty", pointerType: "" },
	])("passes on the $name pointer type under its own name", ({ pointerType }) => {
		expect(getPointerType(new PointerEvent("pointerdown", { pointerType }))).toBe(pointerType);
	});

	it("maps a pointer type core doesn't know to the unknown type", () => {
		expect(getPointerType(new PointerEvent("pointerdown", { pointerType: "finger" }))).toBe("");
	});

	it("maps an event without a pointer type (a MouseEvent click) to the unknown type", () => {
		expect(getPointerType(new MouseEvent("click"))).toBe("");
	});
});

describe("isVirtualPointerEvent", () => {
	it("recognizes a TalkBack press with a pressed button on Android", () => {
		Object.defineProperty(userAgent.os, "android", { value: true, configurable: true });
		try {
			expect(isVirtualPointerEvent(pointerEvent({ buttons: 1 }))).toBe(true);
			expect(isVirtualPointerEvent(pointerEvent({ buttons: 1, pressure: 0.5 }))).toBe(false);
		} finally {
			Object.defineProperty(userAgent.os, "android", { value: false, configurable: true });
		}
	});

	it("ignores the same shape on other pointer types", () => {
		expect(isVirtualPointerEvent(pointerEvent({ pointerType: "touch" }))).toBe(false);
		expect(isVirtualPointerEvent(pointerEvent({ pointerType: "pen" }))).toBe(false);
	});

	it("ignores the same shape on events other than pointerdown", () => {
		expect(isVirtualPointerEvent(pointerEvent({ type: "pointerup" }))).toBe(false);
		expect(isVirtualPointerEvent(pointerEvent({ type: "pointermove" }))).toBe(false);
	});
});
