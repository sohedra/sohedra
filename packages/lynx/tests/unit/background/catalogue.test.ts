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
	hydration_mismatch: {
		difference: `the <view>'s class is "card" on the background and "card wide" in the first frame`,
		where: "src/Card.svelte:4:1",
	},
	props_id_mismatch: {
		tag: "text",
		name: "id",
		expected: "lynx-s3",
		got: "lynx-s2",
		where: "src/Field.svelte:8:1",
	},
	list_item_defer_needs_async_list: { where: "src/Feed.svelte:9:3" },
	initial_scroll_index_past_first_screen: { index: 150, cap: 100, where: "src/Feed.svelte:7:0" },
	initial_item_count_not_a_count: { value: '"three"', where: "src/Feed.svelte:7:0" },
	not_a_main_thread_function: { name: "measure" },
	run_on_background_outside_main_thread: { name: "save" },
	main_thread_ref_read_on_background: {},
	main_thread_ref_set_on_background: {},
	background_function_missing: {},
	plain_function_under_main_thread: {
		name: "main-thread:ontap",
		tag: "view",
		where: "src/Sheet.svelte:14:2",
	},
	main_thread_gesture_not_a_gesture: {
		value: "a function",
		tag: "view",
		where: "src/Sheet.svelte:14:2",
	},
	capture_too_deep: {
		attribute: "main-thread:ontap",
		owner: "view",
		name: "tree",
		depth: 500,
		where: "src/Tree.svelte:12:2",
	},
	element_in_main_thread_function: {
		tag: "view",
		attribute: "main-thread:ontap",
		owner: "text",
		name: "box",
		where: "src/Box.svelte:8:2",
	},
	main_thread_event_spelling_removed: {
		name: "main-thread:bindtap",
		replacement: "main-thread:ontap",
		tag: "view",
		where: "src/Sheet.svelte:14:2",
	},
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
