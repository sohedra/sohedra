// The Viewport decisions, as plain functions.

import { describe, expect, it } from "vitest";

import { getActivationDirection, pinnedEdges } from "../../../src/foundation/position/index.js";
import {
	type ContentKeyState,
	nextContentKey,
} from "../../../src/foundation/position/position-viewport-rules.js";

describe("nextContentKey", () => {
	const committed: ContentKeyState = {
		triggerId: "a",
		payload: 1,
		pendingPayload: false,
		key: 3,
	};

	it("returns the committed state itself while nothing changed", () => {
		expect(nextContentKey(committed, "a", 1)).toBe(committed);
	});

	it("counts a new trigger, and expects its payload when it came without one", () => {
		expect(nextContentKey(committed, "b", 2)).toEqual({
			triggerId: "b",
			payload: 2,
			pendingPayload: false,
			key: 4,
		});
		expect(nextContentKey(committed, "b", 1)).toEqual({
			triggerId: "b",
			payload: 1,
			pendingPayload: true,
			key: 4,
		});
	});

	it("counts the payload that arrives an update after its trigger, once", () => {
		const pending = { ...committed, pendingPayload: true };
		const arrived = nextContentKey(pending, "a", 2);
		expect(arrived).toEqual({ triggerId: "a", payload: 2, pendingPayload: false, key: 4 });
		// A later payload of the same trigger keeps the key.
		expect(nextContentKey(arrived, "a", 3)).toEqual({ ...arrived, payload: 3 });
	});
});

describe("getActivationDirection", () => {
	it("gives no direction without an offset", () => {
		expect(getActivationDirection(null)).toBe(undefined);
	});

	it("names the direction per axis outside a five pixel tolerance", () => {
		expect(getActivationDirection({ horizontal: 100, vertical: -100 })).toBe("right up");
		expect(getActivationDirection({ horizontal: -6, vertical: 5 })).toBe("left ");
		expect(getActivationDirection({ horizontal: 0, vertical: 6 })).toBe(" down");
	});
});

describe("pinnedEdges", () => {
	it("pins the far edges on the top and left sides only", () => {
		expect(pinnedEdges("bottom", false)).toBe(null);
		expect(pinnedEdges("right", false)).toBe(null);
		expect(pinnedEdges("top", false)).toEqual({ vertical: "bottom", horizontal: "left" });
		expect(pinnedEdges("left", false)).toEqual({ vertical: "top", horizontal: "right" });
	});

	it("treats the logical start side as left, by the text direction", () => {
		expect(pinnedEdges("inline-start", false)).toEqual({ vertical: "top", horizontal: "right" });
		expect(pinnedEdges("inline-start", true)).toBe(null);
		expect(pinnedEdges("inline-end", true)).toEqual({ vertical: "top", horizontal: "right" });
	});
});
