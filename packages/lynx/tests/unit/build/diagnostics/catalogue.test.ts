// The build's messages: every entry has its fix and its docs page, and every message is a snapshot.

import { describe, expect, it } from "@rstest/core";

import { BUILD_CATALOGUE } from "../../../../src/build/diagnostics/catalogue.ts";
import type { BuildCode, BuildDetails } from "../../../../src/build/diagnostics/catalogue.ts";
import {
	buildError,
	buildWarning,
	describe as describeMessage,
	placeAt,
} from "../../../../src/build/diagnostics/messages.ts";

/** What each message is written from in the snapshots: one set of details for every code. */
const SAMPLES: { [Code in BuildCode]: BuildDetails[Code] } = {
	preprocess_failed: { reason: "unexpected }" },
	renderer_option_off: {},
	css_injected: {},
	bind_directive: { name: undefined },
	transition_directive: { feature: "`transition:`" },
	in_directive: { feature: "`in:`" },
	out_directive: { feature: "`out:`" },
	animate_directive: { feature: "`animate:`" },
	on_directive: { feature: "`on:`" },
	html_tag: { feature: "`@html`" },
	svelte_window: { feature: "`<svelte:window>`" },
	svelte_document: { feature: "`<svelte:document>`" },
	svelte_body: { feature: "`<svelte:body>`" },
	svelte_head: { feature: "`<svelte:head>`" },
	boundary_needs_async: {},
	main_thread_function_method: { kind: "class" },
	main_thread_function_this: { keyword: "this" },
	main_thread_function_generator: {},
	main_thread_function_block_name: { where: "main-thread:ontap", names: ["row", "index"] },
	main_thread_function_used_early: { name: "onScroll", captures: ["count"] },
	plain_function_in_main_thread_function: { name: "save" },
	script_syntax_error: { reason: "Unexpected token" },
	event_attribute_renamed: { attribute: "bindtap", replacement: "ontap", spelling: "bind" },
	global_event_attribute: { attribute: "global-bindtap", event: "tap" },
	list_item_without_key: {},
};

const CODES = Object.keys(BUILD_CATALOGUE) as BuildCode[];
const SOURCE = { file: "/app/src/App.svelte", text: "<script>\n  let a = 1;\n</script>\n<view />" };

describe("the build's catalogue", () => {
	it("has a sample for each entry", () => {
		expect(Object.keys(SAMPLES).sort()).toEqual([...CODES].sort());
	});

	it.each(CODES)("%s has a fix and a docs page", (code) => {
		const entry = BUILD_CATALOGUE[code];
		expect(entry.fix(SAMPLES[code] as never).trim(), "its fix").not.toBe("");
		expect(entry.docs, "its docs page").toMatch(/^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$/);
	});

	it("gives each entry a page of its own", () => {
		const pages = CODES.map((code) => BUILD_CATALOGUE[code].docs);
		expect(new Set(pages).size).toBe(pages.length);
	});

	it("names the entry's own code as its page", () => {
		for (const code of CODES) expect(BUILD_CATALOGUE[code].docs).toBe(code);
	});

	it("keeps the build's internal words out of every message", () => {
		for (const code of CODES) {
			const text = describeMessage({ code, details: SAMPLES[code] as never });
			expect(text, code).not.toMatch(/\b(?:patch|op|ops|worklet|lepus|svelte-lynx)\b/i);
		}
	});

	it("starts every message with a plain sentence that ends in a period", () => {
		for (const code of CODES) {
			const first = describeMessage({ code, details: SAMPLES[code] as never }).split("\n")[0]!;
			expect(first, code).toMatch(/^[`A-Z].*[.!…`]$|^[`A-Z].*\.$/s);
		}
	});

	it.each(CODES)("%s: the message", (code) => {
		const place = placeAt(SOURCE, SOURCE.text.indexOf("let a"));
		expect(describeMessage({ code, details: SAMPLES[code] as never, place })).toMatchSnapshot();
	});
});

describe("placeAt", () => {
	it("gives the file, the line and column as editors open them, and a frame with a caret", () => {
		const place = placeAt(SOURCE, SOURCE.text.indexOf("let a"));
		expect(place.where).toBe("/app/src/App.svelte:2:3");
		expect(place.frame).toBe("1: <script>\n2:   let a = 1;\n     ^");
	});

	it("has no line before the first", () => {
		expect(placeAt(SOURCE, 0).frame).toBe("1: <script>\n   ^");
	});
});

describe("an error and a warning for a message", () => {
	it("carry the message's stable code, and the error hides its stack", () => {
		const error = buildError({ code: "css_injected", details: {} });
		expect(error).toBeInstanceOf(Error);
		expect(error.code).toBe("css_injected");
		expect(error.hideStack).toBe(true);
		expect(error.message).toBe(describeMessage({ code: "css_injected", details: {} }));
		expect(buildWarning({ code: "list_item_without_key", details: {} })).toEqual({
			code: "list_item_without_key",
			message: describeMessage({ code: "list_item_without_key", details: {} }),
		});
	});
});
