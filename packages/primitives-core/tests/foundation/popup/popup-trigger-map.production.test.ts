// PopupTriggerMap in production, where one element under two ids is allowed. It reads `DEV` from
// `esm-env`, so this file mocks `esm-env` with `DEV: false` (in a file of its own, as a mock applies
// to the whole module graph).
import type * as EsmEnv from "esm-env";
import { describe, expect, it, vi } from "vitest";

import { PopupTriggerMap } from "../../../src/foundation/popup/popup-trigger-map.js";
import { element } from "../../kit/kit-stand-ins.js";

vi.mock("esm-env", async (importOriginal) => ({
	...(await importOriginal<typeof EsmEnv>()),
	DEV: false,
}));

describe("PopupTriggerMap", () => {
	it("does not throw in production when the same element is registered under multiple ids", () => {
		const map = new PopupTriggerMap();
		const button = element("trigger");

		map.add("first", button);
		expect(() => map.add("second", button)).not.toThrow();
		expect(map.getById("first")).toBe(button);
		expect(map.getById("second")).toBe(button);
		expect(map.hasElement(button)).toBe(true);
		expect(map.size).toBe(2);
	});
});
