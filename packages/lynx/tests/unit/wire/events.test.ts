// The event grammar: a component writes `ontap`, and Lynx spells the event `bindtap`.

import { describe, expect, it } from "@rstest/core";

import { lynxEventName, removedEventSpelling } from "../../../src/wire/index.ts";

describe("lynxEventName", () => {
	it.each([
		["ontap", "bindtap"],
		["ontapcapture", "capture-bindtap"],
		["oncatchtap", "catchtap"],
		["oncatchtapcapture", "capture-catchtap"],
		// Svelte's two events that end in `capture` without being capture listeners.
		["ongotpointercapture", "bindgotpointercapture"],
		["onlostpointercapture", "bindlostpointercapture"],
		["ongotpointercapturecapture", "capture-bindgotpointercapture"],
		// `catch` alone is an event name, not the prefix.
		["oncatch", "bindcatch"],
		["oncatchcapture", "capture-bindcatch"],
		["oncapture", "capture-bind"],
		// Any case, and any name that starts with `on`.
		["onTap", "bindTap"],
		["online", "bindline"],
		["on", "bind"],
	])("writes %s as %s", (name, lynx) => {
		expect(lynxEventName(name)).toBe(lynx);
	});

	it("leaves a name that does not start with `on` as it is", () => {
		expect(lynxEventName("bindtap")).toBe("bindtap");
		expect(lynxEventName("class")).toBe("class");
	});
});

describe("removedEventSpelling", () => {
	it.each([
		["bindtap", "tap", "ontap"],
		["catchtap", "tap", "oncatchtap"],
		["capture-bindtap", "tap", "ontapcapture"],
		["capture-catchtap", "tap", "oncatchtapcapture"],
		["bindscrolltolower", "scrolltolower", "onscrolltolower"],
		["global-bindtap", "tap", undefined],
	])("names what replaces %s", (name, event, replacement) => {
		expect(removedEventSpelling(name)).toEqual({ event, replacement });
	});

	it("is undefined for the grammar's own names and for any other name", () => {
		for (const name of ["ontap", "oncatchtap", "ontapcapture", "class", "bind", "catch", "id"])
			expect(removedEventSpelling(name)).toBeUndefined();
	});

	it("names the replacement that lynxEventName turns back into the removed spelling", () => {
		for (const name of ["bindtap", "catchtap", "capture-bindtap", "capture-catchtap"]) {
			const { replacement } = removedEventSpelling(name)!;
			expect(lynxEventName(replacement!)).toBe(name);
		}
	});
});
