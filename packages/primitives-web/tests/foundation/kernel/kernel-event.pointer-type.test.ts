// The web's mapping of a native pointer type onto core's pointer types.

import { describe, expect, it } from "vitest";

import { getPointerType } from "#lib/foundation/kernel/index.js";

describe("getPointerType", () => {
	it("passes on the pointer types core interprets under their own names", () => {
		for (const pointerType of ["mouse", "pen", "touch", ""]) {
			expect(getPointerType(new PointerEvent("pointerdown", { pointerType }))).toBe(pointerType);
		}
	});

	it("maps a pointer type core doesn't know to the unknown type", () => {
		expect(getPointerType(new PointerEvent("pointerdown", { pointerType: "finger" }))).toBe("");
	});

	it("maps an event without a pointer type (a MouseEvent click) to the unknown type", () => {
		expect(getPointerType(new MouseEvent("click"))).toBe("");
	});
});
