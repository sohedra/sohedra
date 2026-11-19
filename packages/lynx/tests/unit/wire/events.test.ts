// The event rule, as one table: every spelling a component writes names one Lynx event, a type and
// a name, on the background or, after `main-thread:`, on the main thread; every spelling of Lynx's
// own is refused with what to write instead. The compiler and both threads read this one rule.

import { describe, expect, it } from "@rstest/core";

import {
	eventOf,
	listenerEvent,
	lynxEventName,
	removedEventSpelling,
} from "../../../src/wire/index.ts";
import type { LynxEventType } from "../../../src/wire/index.ts";

/** An attribute a component writes: Lynx's type and name, and Lynx's spelling of it. */
const SPELLINGS: [attribute: string, type: LynxEventType, name: string, lynx: string][] = [
	["ontap", "bindEvent", "tap", "bindtap"],
	["ontapcapture", "capture-bind", "tap", "capture-bindtap"],
	["oncatchtap", "catchEvent", "tap", "catchtap"],
	["oncatchtapcapture", "capture-catch", "tap", "capture-catchtap"],
	["onscrolltolower", "bindEvent", "scrolltolower", "bindscrolltolower"],
	// Svelte's two events that end in `capture` without being capture listeners.
	["ongotpointercapture", "bindEvent", "gotpointercapture", "bindgotpointercapture"],
	["onlostpointercapture", "bindEvent", "lostpointercapture", "bindlostpointercapture"],
	[
		"ongotpointercapturecapture",
		"capture-bind",
		"gotpointercapture",
		"capture-bindgotpointercapture",
	],
	// `catch` alone is an event name, not the prefix.
	["oncatch", "bindEvent", "catch", "bindcatch"],
	["oncatchcapture", "capture-bind", "catch", "capture-bindcatch"],
	// Svelte's rule, whatever follows `on`: any case, and an empty name.
	["onTap", "bindEvent", "Tap", "bindTap"],
	["online", "bindEvent", "line", "bindline"],
	["oncapture", "capture-bind", "", "capture-bind"],
	["on", "bindEvent", "", "bind"],
];

/** A spelling of Lynx's own: the event it names and what a component writes instead. */
const REMOVED: [attribute: string, event: string, replacement: string | undefined][] = [
	["bindtap", "tap", "ontap"],
	["catchtap", "tap", "oncatchtap"],
	["capture-bindtap", "tap", "ontapcapture"],
	["capture-catchtap", "tap", "oncatchtapcapture"],
	["bindscrolltolower", "scrolltolower", "onscrolltolower"],
	// A listener on the page's root is `on(root, …)`: no attribute replaces it.
	["global-bindtap", "tap", undefined],
];

const PREFIX = "main-thread:";

describe("the event rule", () => {
	describe.each([
		["on the background", ""],
		["on the main thread", PREFIX],
	])("%s", (_, prefix) => {
		it.each(SPELLINGS)("%s is the Lynx event %s %s", (attribute, type, name, lynx) => {
			const written = prefix + attribute;
			expect(eventOf(written)).toEqual({ type, name, mainThread: prefix !== "" });
			expect(lynxEventName(written)).toBe(prefix + lynx);
			expect(removedEventSpelling(written)).toBeUndefined();
		});

		it.each(REMOVED)("%s is refused, naming %s and its replacement", (attribute, event, after) => {
			const written = prefix + attribute;
			expect(eventOf(written)).toBeUndefined();
			expect(removedEventSpelling(written)).toEqual({
				event,
				replacement: after === undefined ? undefined : prefix + after,
			});
		});
	});

	it("names no event for any other attribute", () => {
		for (const name of ["class", "id", "bind", "catch", "main-thread:ref", "main-thread:class"]) {
			expect(eventOf(name), name).toBeUndefined();
			expect(lynxEventName(name), name).toBe(name);
			expect(removedEventSpelling(name), name).toBeUndefined();
		}
	});

	it("turns each replacement back into the spelling it replaces", () => {
		for (const [attribute] of REMOVED.filter(([, , after]) => after !== undefined)) {
			for (const prefix of ["", PREFIX]) {
				const { replacement } = removedEventSpelling(prefix + attribute)!;
				expect(lynxEventName(replacement!)).toBe(prefix + attribute);
			}
		}
	});
});

describe("listenerEvent", () => {
	// `on(node, type, fn, { capture })`: Svelte has taken off `on` and the `capture` suffix.
	it.each([
		["tap", false, "bindEvent", "tap"],
		["tap", true, "capture-bind", "tap"],
		["catchtap", false, "catchEvent", "tap"],
		["catchtap", true, "capture-catch", "tap"],
		["catch", false, "bindEvent", "catch"],
	] as const)("binds %s (capture %s) as %s %s", (event, capture, type, name) => {
		expect(listenerEvent(event, capture)).toEqual({ type, name });
	});

	it("is the rule the attributes follow", () => {
		for (const [attribute, type, name] of SPELLINGS) {
			const capture = type === "capture-bind" || type === "capture-catch";
			const written = attribute.slice(2, capture ? -"capture".length : undefined);
			expect(listenerEvent(written, capture), attribute).toEqual({ type, name });
		}
	});
});
