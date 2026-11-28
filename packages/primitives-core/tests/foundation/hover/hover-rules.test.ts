// The hover rules as facts in and an outcome out: the delays and timing rows, click-like and hover
// opens, what a click pins, how far a move must go, and when an enter opens at once.
import { describe, expect, it } from "vitest";

import {
	getDelay,
	hasMovedEnough,
	isClickLikeOpenEvent,
	isPinnedByClick,
	opensAtOnceOnEnter,
} from "../../../src/foundation/hover/hover-rules.js";
import { getHoverTiming, isHoverOpenEvent } from "../../../src/foundation/hover/index.js";

describe("getDelay", () => {
	it("resolves delays, with no delay for touch", () => {
		expect(getDelay(100, "open")).toBe(100);
		expect(getDelay({ close: 50 }, "close", "mouse")).toBe(50);
		expect(getDelay({ close: 50 }, "open")).toBeUndefined();
		expect(getDelay(100, "open", "touch")).toBe(0);
	});
});

describe("isClickLikeOpenEvent and isHoverOpenEvent", () => {
	it("tells click and hover opens apart", () => {
		expect(isClickLikeOpenEvent("click", false)).toBe(true);
		expect(isClickLikeOpenEvent("mouseenter", true)).toBe(true);
		expect(isHoverOpenEvent("mouseenter")).toBe(true);
		expect(isHoverOpenEvent("mousemove")).toBe(true);
		expect(isHoverOpenEvent("mousedown")).toBe(false);
		expect(isHoverOpenEvent("click")).toBe(false);
		expect(isHoverOpenEvent("keydown")).toBe(false);
		expect(isHoverOpenEvent("imperative-action")).toBe(false);
		expect(isHoverOpenEvent(undefined)).toBe(false);
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

// A bound `open` set to false from outside passes no request, so nothing clears the recorded open
// event: a click pins a popup only while it is open.
describe("isPinnedByClick", () => {
	it("holds an open popup that a click opened, or that was pressed inside", () => {
		expect(isPinnedByClick(true, "click", false)).toBe(true);
		expect(isPinnedByClick(true, "mousedown", false)).toBe(true);
		expect(isPinnedByClick(true, "mouseenter", true)).toBe(true);
	});

	it("doesn't hold a hover-opened popup", () => {
		expect(isPinnedByClick(true, "mouseenter", false)).toBe(false);
		expect(isPinnedByClick(true, undefined, false)).toBe(false);
	});

	it("holds nothing once the popup is closed, whatever opened it", () => {
		expect(isPinnedByClick(false, "click", false)).toBe(false);
		expect(isPinnedByClick(false, "mousedown", false)).toBe(false);
		expect(isPinnedByClick(false, "mouseenter", true)).toBe(false);
	});
});

describe("hasMovedEnough", () => {
	it("restarts a pending rest only for a move of at least √2px", () => {
		expect(hasMovedEnough(0, 0)).toBe(false);
		expect(hasMovedEnough(1, 0)).toBe(false);
		expect(hasMovedEnough(0, -1)).toBe(false);
		expect(hasMovedEnough(1, 1)).toBe(true);
		expect(hasMovedEnough(-1, -1)).toBe(true);
		expect(hasMovedEnough(0, 2)).toBe(true);
	});
});
