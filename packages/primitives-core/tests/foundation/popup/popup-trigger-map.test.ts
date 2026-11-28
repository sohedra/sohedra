// PopupTriggerMap in development: registration under ids, the lookups, and the error for one
// element under two ids, which starts with `Sohedra:`.
import { describe, expect, it } from "vitest";

import { PopupTriggerMap } from "../../../src/foundation/popup/popup-trigger-map.js";
import { element as button } from "../../kit/kit-stand-ins.js";

const MULTIPLE_IDS_ERROR =
	"Sohedra: A trigger element cannot be registered under multiple IDs in PopupTriggerMap.";

describe("PopupTriggerMap", () => {
	it("does not duplicate when the same element is added twice with the same id", () => {
		const map = new PopupTriggerMap();
		const element = button("trigger");

		map.add("trigger", element);
		map.add("trigger", element);

		expect(map.getById("trigger")).toBe(element);
		expect(map.size).toBe(1);
	});

	it("keeps an unrelated element claim when another id is deleted", () => {
		const map = new PopupTriggerMap();
		const first = button("first");
		const second = button("second");

		map.add("first", first);
		map.add("second", second);
		map.delete("second");

		expect(() => map.add("other", first)).toThrow(MULTIPLE_IDS_ERROR);
	});

	it("still throws when a re-added element is registered under a second id", () => {
		const map = new PopupTriggerMap();
		const element = button("trigger");

		map.add("first", element);
		map.add("first", element);

		expect(() => map.add("second", element)).toThrow(MULTIPLE_IDS_ERROR);
	});

	it("registers and looks up triggers", () => {
		const map = new PopupTriggerMap();
		const a = button("a");
		map.add("a", a);
		expect(map.size).toBe(1);
		expect(map.hasElement(a)).toBe(true);
		expect(map.getById("a")).toBe(a);
		expect(map.hasMatchingElement((e) => e === a)).toBe(true);
		map.delete("a");
		expect(map.size).toBe(0);
	});

	it("refuses one element under two ids in development", () => {
		const map = new PopupTriggerMap();
		const a = button("a");
		map.add("a", a);
		expect(() => map.add("b", a)).toThrow(/multiple IDs/);
		// Reusing an id for another element frees the first element's claim.
		map.add("a", button("other"));
		expect(() => map.add("b", a)).not.toThrow();
	});
});
