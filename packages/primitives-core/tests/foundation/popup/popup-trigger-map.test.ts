// The trigger map: registration under ids, the reverse lookup and its development error. The
// production case is in popup-trigger-map.production.test.ts. Core has no DOM, so the trigger
// elements are opaque objects; the error starts with `Sohedra:`.

import { describe, expect, it } from "vitest";

import { PopupTriggerMap } from "../../../src/foundation/popup/popup-trigger-map.js";

const button = (name: string) => ({ name }) as unknown as Element;

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
});

// From geometry-and-tree.test.ts.
const element = (name: string) => ({ name }) as unknown as Element;

describe("PopupTriggerMap", () => {
	it("registers and looks up triggers", () => {
		const map = new PopupTriggerMap();
		const a = element("a");
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
		const a = element("a");
		map.add("a", a);
		expect(() => map.add("b", a)).toThrow(/multiple IDs/);
		// Reusing an id for another element frees the first element's claim.
		map.add("a", element("other"));
		expect(() => map.add("b", a)).not.toThrow();
	});
});
