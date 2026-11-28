// The hover rules: the enter rule, the safe polygon as a pure step, and the one call that drops a
// pending open.

import { describe, expect, it, vi } from "vitest";

import { opensAtOnceOnEnter } from "../../../src/foundation/hover/hover-rules.js";
import {
	type Box,
	decideSafePolygon,
	type SafePolygonInput,
	startSafePolygon,
} from "../../../src/foundation/hover/hover-safe-polygon-rules.js";
import { getHoverTiming, HoverInteraction } from "../../../src/foundation/hover/index.js";
import { createFakePlatform } from "../../kit/kit-fake-platform.js";

describe("opensAtOnceOnEnter", () => {
	it("opens at once when the pointer moves to another trigger of an open popup", () => {
		expect(opensAtOnceOnEnter(true, false, true, false)).toBe(true);
		// The popup is closed and no hover close is running: the trigger's own delays apply.
		expect(opensAtOnceOnEnter(false, false, true, false)).toBe(false);
	});

	it("opens at once when the pointer returns while a hover close runs", () => {
		expect(opensAtOnceOnEnter(false, true, false, true)).toBe(true);
		expect(opensAtOnceOnEnter(false, true, true, false)).toBe(true);
		// Not on the popup's own reference, and not another trigger of it.
		expect(opensAtOnceOnEnter(false, true, false, false)).toBe(false);
	});

	it("waits for the delays when the pointer enters the owning trigger of an open popup", () => {
		expect(opensAtOnceOnEnter(true, false, false, true)).toBe(false);
	});
});

describe("decideSafePolygon", () => {
	const box = (left: number, top: number, width: number, height: number): Box => ({
		left,
		top,
		width,
		height,
		right: left + width,
		bottom: top + height,
	});
	// Trigger at 100,100 (100×20); popup below it at 50,130 (200×100), a 10px gap.
	const move = (clientX: number, clientY: number, overrides = {}): SafePolygonInput => ({
		clientX,
		clientY,
		isLeave: false,
		isOverFloating: false,
		isOverReference: false,
		leavingIntoFloating: false,
		hasOpenChild: false,
		measure: () => ({ reference: box(100, 100, 100, 20), floating: box(50, 130, 200, 100) }),
		now: 0,
		...overrides,
	});

	it("returns the next track and leaves the one it was given as it is", () => {
		const start = startSafePolygon("bottom", 150, 121, 0);
		const snapshot = { ...start };
		const first = decideSafePolygon(start, move(95, 128, { now: 1 }));
		expect(first.decision).toBe("close-soon");
		expect(start).toEqual(snapshot);
		expect(first.track).toMatchObject({ hasLanded: false, lastX: 95, lastY: 128, lastTime: 1 });

		const landed = decideSafePolygon(first.track, move(95, 140, { isOverFloating: true, now: 2 }));
		expect(landed.decision).toBe("stay");
		expect(landed.track.hasLanded).toBe(true);
		expect(first.track.hasLanded).toBe(false);
	});

	it("gives the same answer for the same track and move", () => {
		const track = startSafePolygon("bottom", 150, 121, 0);
		const input = move(95, 128, { now: 1 });
		expect(decideSafePolygon(track, input)).toEqual(decideSafePolygon(track, input));
	});

	it("closes a pointer that stops moving inside the triangle", () => {
		const start = startSafePolygon("bottom", 150, 121, 0);
		const first = decideSafePolygon(start, move(95, 128, { now: 1 }));
		// 1px in 100ms is slower than the threshold.
		const slow = decideSafePolygon(first.track, move(96, 128, { now: 101 }));
		expect(slow.decision).toBe("close");
	});
});

describe("HoverInteraction", () => {
	it("drops a pending delayed open and a pending rest open in one call", () => {
		const { scheduler } = createFakePlatform();
		const hover = new HoverInteraction(scheduler);
		const callback = vi.fn();
		hover.openChangeTimeout.start(100, callback);
		hover.restTimeout.start(100, callback);
		hover.restTimeoutPending = true;
		hover.cancelPendingOpen();
		scheduler.advance(200);
		expect(callback).not.toHaveBeenCalled();
		expect(hover.restTimeoutPending).toBe(false);
	});
});

describe("getHoverTiming", () => {
	it("waits for the rest on a rest row, and closes after the close delay", () => {
		expect(getHoverTiming({ mouseOnly: true, delay: "rest" }, 300, 50)).toEqual({
			mouseOnly: true,
			restMs: 300,
			delay: { close: 50 },
		});
	});

	it("delays the open itself on an enter row, with no rest", () => {
		expect(getHoverTiming({ mouseOnly: false, delay: "enter" }, 600, 300)).toEqual({
			mouseOnly: false,
			restMs: 0,
			delay: { open: 600, close: 300 },
		});
	});

	it("passes undefined delays through", () => {
		expect(getHoverTiming({ mouseOnly: true, delay: "enter" }, undefined, undefined)).toEqual({
			mouseOnly: true,
			restMs: 0,
			delay: { open: undefined, close: undefined },
		});
		expect(getHoverTiming({ mouseOnly: true, delay: "rest" }, undefined, undefined).delay).toEqual({
			close: undefined,
		});
	});
});
