// A gesture travels as the value of `main-thread:gesture`: one gesture, or a composed one holding
// several. The main thread tells it from any other value by its mark.

import { describe, expect, it } from "@rstest/core";

import {
	decodePatch,
	encodePatch,
	GestureType,
	isGesture,
	OpCode,
} from "../../../src/wire/index.ts";
import type { SerializedGesture } from "../../../src/wire/index.ts";

const PAN: SerializedGesture = {
	id: 1,
	type: GestureType.PAN,
	config: { enabled: true, minDistance: 10 },
	callbacks: { onUpdate: { _wkltId: "a1b2:onPan" } },
	waitFor: [{ id: 2 }],
	simultaneousWith: [],
	continueWith: [],
	__isSerialized: true,
};

const RACE: SerializedGesture = {
	type: GestureType.COMPOSED,
	gestures: [PAN, { ...PAN, id: 2, type: GestureType.TAP, waitFor: [] }],
	__isSerialized: true,
};

describe("a gesture", () => {
	it("crosses in an attribute's value and is known by its mark", () => {
		const { items } = decodePatch(
			encodePatch({
				page: 0,
				items: [["ops", [[OpCode.SetAttr, 3, "main-thread:gesture", RACE]]]],
			}),
		);
		const [, ops] = items[0] as ["ops", [number, number, string, unknown][]];
		const value = ops[0]![3];
		expect(value).toEqual(RACE);
		expect(isGesture(value)).toBe(true);
	});

	it("is not any other value", () => {
		for (const value of [null, undefined, 1, "pan", { type: 0, id: 1 }, { __isSerialized: "yes" }])
			expect(isGesture(value)).toBe(false);
	});

	it("numbers its types as Lynx's detectors do", () => {
		expect(GestureType).toEqual({
			COMPOSED: -1,
			PAN: 0,
			FLING: 1,
			DEFAULT: 2,
			TAP: 3,
			LONGPRESS: 4,
			ROTATION: 5,
			PINCH: 6,
			NATIVE: 7,
		});
	});
});
