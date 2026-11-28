// The map does not throw in production when the same element is registered under two ids. It reads
// `DEV` from `esm-env`, so this file mocks `esm-env` with `DEV: false` (in a file of its own, as a
// mock applies to the whole module graph). Core has no DOM, so the element is an opaque object.

import { describe, expect, it, vi } from "vitest";

import { PopupTriggerMap } from "../../../src/foundation/popup/popup-trigger-map.js";

vi.mock("esm-env", async (importOriginal) => ({
	...(await importOriginal<typeof import("esm-env")>()),
	DEV: false,
}));

describe("PopupTriggerMap", () => {
	it("does not throw in production when the same element is registered under multiple ids", () => {
		const map = new PopupTriggerMap();
		const button = { name: "trigger" } as unknown as Element;

		map.add("first", button);
		expect(() => map.add("second", button)).not.toThrow();
		expect(map.getById("first")).toBe(button);
		expect(map.getById("second")).toBe(button);
		expect(map.hasElement(button)).toBe(true);
		expect(map.size).toBe(2);
	});
});
