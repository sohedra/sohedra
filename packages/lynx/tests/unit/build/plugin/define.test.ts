// `define` gives constants that differ by thread. The rules of each thread replace them (the
// rules are checked in tests/build); this is how an option becomes the code that replaces a key.

import { describe, expect, it } from "@rstest/core";

import { defineCode } from "../../../../src/build/plugin/options.ts";
import {
	PLUGIN_DEFINE_KEYS,
	pluginDefines,
	threadDefines,
} from "../../../../src/build/plugin/thread-defines.ts";

describe("defineCode", () => {
	it("keeps a string as the code that replaces the key, and writes the rest as JSON", () => {
		expect(defineCode({ A: '"x"', B: 3, C: true, D: null, E: "1 + 1" })).toEqual({
			A: '"x"',
			B: "3",
			C: "true",
			D: "null",
			E: "1 + 1",
		});
		expect(defineCode(undefined)).toEqual({});
	});
});

describe("the plugin's own constants", () => {
	it("give __LEPUS__ and __JS__ ReactLynx's values beside the binding's own names", () => {
		expect(threadDefines("main-thread", false)).toEqual({
			__MAIN_THREAD__: "true",
			__BACKGROUND__: "false",
			__LEPUS__: "true",
			__JS__: "false",
			__DEV__: "false",
		});
		expect(threadDefines("background", true)).toEqual({
			__MAIN_THREAD__: "false",
			__BACKGROUND__: "true",
			__LEPUS__: "false",
			__JS__: "true",
			__DEV__: "true",
		});
	});

	it("add the first frame's flag in a build, and are the keys `define` refuses", () => {
		expect(pluginDefines("background", { development: false, firstFrame: true })).toMatchObject({
			__FIRST_FRAME__: "true",
			__BACKGROUND__: "true",
		});
		expect(PLUGIN_DEFINE_KEYS.toSorted((a, b) => a.localeCompare(b))).toEqual([
			"__BACKGROUND__",
			"__DEV__",
			"__FIRST_FRAME__",
			"__JS__",
			"__LEPUS__",
			"__MAIN_THREAD__",
		]);
	});
});
