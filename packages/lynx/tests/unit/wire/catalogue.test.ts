// The wire's messages: every entry has its fix and its docs page, and every message is a snapshot.

import { describe, expect, it } from "@rstest/core";

import { WIRE_CATALOGUE, wireMessage } from "../../../src/wire/index.ts";
import type { WireCode, WireDetails } from "../../../src/wire/index.ts";

const SAMPLES: { [Code in WireCode]: WireDetails[Code] } = {
	threads_from_different_builds: { thread: "main-thread", received: 2, expected: 1 },
	page_reloaded_on_one_thread: { thread: "main-thread", received: 2, page: 1 },
	value_not_copyable: { thread: "main-thread", reason: "Do not know how to serialize a BigInt" },
	change_not_applied: {
		reason: "The main thread has no element 7.",
		change: "insert <view> 42 into <scroll-view> 7",
	},
};

const CODES = Object.keys(WIRE_CATALOGUE) as WireCode[];

describe("the wire's catalogue", () => {
	it("has a sample for each entry", () => {
		expect(Object.keys(SAMPLES).sort()).toEqual([...CODES].sort());
	});

	it.each(CODES)("%s has a fix and its own code as its docs page", (code) => {
		const entry = WIRE_CATALOGUE[code];
		// The samples hold each code's own details, which TypeScript cannot pair through an index.
		expect(entry.fix(SAMPLES[code] as never).trim()).not.toBe("");
		expect(entry.docs).toBe(code);
	});

	it.each(CODES)("%s: the message", (code) => {
		const text = wireMessage({ code, details: SAMPLES[code] as never });
		expect(text.split("\n")[0]).toMatch(/^[A-Z].*\.$/);
		expect(text).not.toMatch(/\b(?:patch|op|ops|worklet|lepus|svelte-lynx|generation|wire)\b/i);
		expect(text).toMatchSnapshot();
	});
});
