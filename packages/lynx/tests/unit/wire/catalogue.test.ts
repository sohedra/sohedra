// The wire's messages: every entry has its fix and its docs page, and every message is a snapshot.

import { describe, expect, it } from "@rstest/core";

import { WIRE_CATALOGUE, wireMessage } from "../../../src/wire/index.ts";
import type { WireCode, WireDetails } from "../../../src/wire/index.ts";

const SAMPLES: { [Code in WireCode]: WireDetails[Code] } = {
	threads_from_different_builds: { thread: "main-thread", received: 2, expected: 1 },
};

const CODES = Object.keys(WIRE_CATALOGUE) as WireCode[];

describe("the wire's catalogue", () => {
	it("has a sample for each entry", () => {
		expect(Object.keys(SAMPLES).sort()).toEqual([...CODES].sort());
	});

	it.each(CODES)("%s has a fix and its own code as its docs page", (code) => {
		const entry = WIRE_CATALOGUE[code];
		expect(entry.fix(SAMPLES[code]).trim()).not.toBe("");
		expect(entry.docs).toBe(code);
	});

	it.each(CODES)("%s: the message", (code) => {
		const text = wireMessage({ code, details: SAMPLES[code] });
		expect(text.split("\n")[0]).toMatch(/^[A-Z].*\.$/);
		expect(text).not.toMatch(/\b(?:patch|op|ops|worklet|lepus|svelte-lynx|generation|wire)\b/i);
		expect(text).toMatchSnapshot();
	});
});
