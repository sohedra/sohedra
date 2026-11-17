// The background's messages: every entry has its fix and its docs page, and every message is a
// snapshot.

import { describe, expect, it } from "@rstest/core";

import { BACKGROUND_CATALOGUE, backgroundMessage } from "../../../src/background/catalogue.ts";
import type { BackgroundCode, BackgroundDetails } from "../../../src/background/catalogue.ts";

const SAMPLES: { [Code in BackgroundCode]: BackgroundDetails[Code] } = {
	page_is_gone: { call: "scrollTo" },
	text_outside_text: { text: "Hello", parent: "view", where: "src/App.svelte:3:1" },
	list_item_key_object: { where: "src/Feed.svelte:12:2" },
	input_value_not_written: { tag: "input", reason: "Lynx answered setValue with the code 4." },
	attribute_not_copyable: {
		name: "accessibility-actions",
		tag: "view",
		reason: "Do not know how to serialize a BigInt",
	},
	element_not_on_page: { method: "boundingClientRect", tag: "view" },
	element_not_shown: { method: "boundingClientRect", tag: "view" },
	animation_canceled: { tag: "view", name: "fade" },
};

// Boundary: the keys of the catalogue are its codes.
const CODES = Object.keys(BACKGROUND_CATALOGUE) as BackgroundCode[];

describe("the background's catalogue", () => {
	it("has a sample for each entry", () => {
		expect(Object.keys(SAMPLES).sort()).toEqual([...CODES].sort());
	});

	it.each(CODES)("%s has a fix and its own code as its docs page", (code) => {
		const entry = BACKGROUND_CATALOGUE[code];
		expect(entry.fix(SAMPLES[code] as never).trim()).not.toBe("");
		expect(entry.docs).toBe(code);
	});

	it.each(CODES)("%s: the message", (code) => {
		const text = backgroundMessage({ code, details: SAMPLES[code] as never });
		expect(text.split("\n")[0]).toMatch(/^[A-Z].*\.$/);
		expect(text).not.toMatch(/\b(?:patch|op|ops|worklet|lepus|svelte-lynx|generation|wire)\b/i);
		expect(text).toMatchSnapshot();
	});
});
