// A browser unit test of `isVirtualPointerEvent` (src/foundation/kernel/kernel-event.ts).
// Notes:
// - The platform flags are `#lib/foundation/kernel/kernel-user-agent.js`, mocked with Android off.
// The Android case flips `os.android` on the mocked object.
// - The pressureless 1x1 mouse pointerdown of a screen reader press, the pressed mouse and the iOS
// VoiceOver touch are covered through Menu.

import { describe, expect, it, vi } from "vitest";

import { isVirtualPointerEvent, userAgent } from "#lib/foundation/kernel/index.js";

vi.mock("#lib/foundation/kernel/kernel-user-agent.js", async (importOriginal) => {
	const actual =
		await importOriginal<typeof import("#lib/foundation/kernel/kernel-user-agent.js")>();

	return {
		...actual,
		userAgent: {
			...actual.userAgent,
			os: { ...actual.userAgent.os, android: false },
		},
	};
});

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
