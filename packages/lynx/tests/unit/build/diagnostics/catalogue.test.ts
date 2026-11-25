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
import { INTERNAL_WORDS } from "../../../contract/messages/internal-words.ts";

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
	main_thread_function_method: { kind: "class" },
	main_thread_function_this: { keyword: "this" },
	main_thread_function_generator: {},
	main_thread_function_block_name: { where: "main-thread:ontap", names: ["row", "index"] },
	main_thread_function_used_early: { name: "onScroll", captures: ["count"] },
	main_thread_function_typescript: {
		feature: "an `enum`",
		instead: "an object of its values (`const Color = { Red: 0 } as const`)",
	},
	typescript_stripper_missing: { version: "v20.19.0" },
	plain_function_in_main_thread_function: { name: "save" },
	shared_import_needed: { written: "report", name: "reportError" },
	thread_function_unclear: { written: "toBackground", name: "runOnBackground" },
	script_syntax_error: { reason: "Unexpected token" },
	regexp_refused: { regexp: "/(?i:a)b/", syntax: "modifier" },
	regexp_refused_call: { regexp: 'new RegExp("[\\\\p{L}--[a-z]]", "v")', syntax: "v_flag" },
	event_attribute_renamed: { attribute: "bindtap", replacement: "ontap", spelling: "bind" },
	global_event_attribute: { attribute: "global-bindtap", event: "tap" },
	list_item_without_key: {},
	thread_branch_test: { test: "background && user" },
	thread_branch_name_taken: { name: "SohedraLynxThreadBranch" },
	thread_flag_outside_if: { read: "label", flag: "background" },
	list_item_defer_ignored: { written: "in a spread" },
	fill_not_imported: {
		name: "TextEncoder",
		module: "@sohedra/lynx-polyfill/encoding",
		baseline: true,
		lacks: "engine",
	},
	global_no_fill: {
		name: "Intl",
		instead:
			"Format dates and numbers with a library in plain JavaScript, such as date-fns or dayjs.",
	},
	dom_not_on_lynx: {
		name: "document",
		instead:
			"Reach an element with `{@attach}` on the background, or with `main-thread:ref` in a main-thread function, and use its methods.",
	},
	background_api_on_main_thread: { api: "NativeModules", where: "function" },
	main_thread_api_in_background: { api: "__CreateView" },
	lynx_member_missing: { api: "lynx.querySelector" },
	css_selector_unsupported: { selector: "a[href] > .b", part: "the attribute selector `[href]`" },
	main_thread_handler_in_thread_branch: {
		attribute: "main-thread:ontap",
		branch: "`{#if background}`",
	},
	svelte_mount_imported: { name: "mount" },
	media_query_imported: { name: "MediaQuery" },
	svelte_module_unsupported: { module: "svelte/motion" },
	unknown_plugin_option: { name: "firstframe", suggestion: "firstFrame" },
	plugin_option_type: {
		name: "firstFrame",
		expected: "a boolean or a function of the entry's name that returns one",
		given: '"yes"',
	},
	engine_version_old: { version: "3.9", minimum: "4.2" },
	engine_version_new: { version: "4.4", maximum: "4.3" },
	define_thread_unknown: { name: "worker" },
	define_key_reserved: { name: "define.mainThread.__DEV__" },
	define_key_invalid: { name: "define.mainThread.a.b" },
	page_config_reserved: { key: "enableA11y" },
	dedupe_name: { given: '["./local"]' },
	first_frame_not_boolean: { entry: "settings", given: '"yes"' },
	css_not_stored: { file: "/app/src/Card.svelte" },
	hot_footer_missing: { file: "/app/src/Card.svelte" },
	svelte_missing: { root: "/app", range: "~5.59.0" },
	test_peers_missing: {
		packages: ["jsdom", "@testing-library/dom"],
		preset: "withSvelteLynx()",
		root: "/app",
	},
	svelte_without_renderers: { version: "5.40.0", where: "/app", range: "~5.59.0" },
	svelte_version_untested: {
		version: "5.60.0",
		where: "/app",
		range: "~5.59.0",
		direction: "above",
	},
	lynx_engine_missing: {},
	template_plugin_versions: { engine: "0.15.4", own: "0.16.8", range: "^0.16.8" },
	encoder_not_handed_over: {
		reason: "its LynxEncodePlugin has no encodePool to run the encode step in",
	},
	svelte_config_invalid: {
		file: "/app/svelte.config.js",
		reason: "it has no default export that is an object",
	},
	svelte_config_option_owned: { key: "generate" },
	svelte_config_option_unsupported: { key: "accessors" },
	iife_ignored: { value: "true" },
	main_thread_asset_missing: { file: ".lynx/main/main-thread.js" },
	rsbuild_swc_missing: {},
	spread_setter_moved: {
		file: "/app/node_modules/svelte/src/internal/client/reactivity/props.js",
		anchor: "get_descriptor(props, key)?.set ??",
	},
	dev_client_moved: {
		file: "node_modules/@lynx-js/webpack-dev-transport/lib/client/reloadApp.js",
		anchor: "function reloadPage() {",
	},
	primjs_regex_moved: {
		file: "/app/node_modules/svelte/src/utils.js",
		name: "REGEX_VALID_TAG_NAME",
	},
	background_only_in_component: { file: "src/Card.svelte" },
	background_only_reexport_all: { file: "src/store.ts", from: "./other" },
	background_only_used: { used: "store.value", file: "src/store.ts" },
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
			expect(text, code).not.toMatch(INTERNAL_WORDS);
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

	it.each([
		["/[\\p{L}--[a-z]]/v", "v_flag"],
		["/x/d", "d_flag"],
		["/(?<y>a)|(?<y>b)/", "duplicate_group"],
	] as const)("regexp_refused for %s: the message", (regexp, syntax) => {
		expect(
			describeMessage({ code: "regexp_refused", details: { regexp, syntax } }),
		).toMatchSnapshot();
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
