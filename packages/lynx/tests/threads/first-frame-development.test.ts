// The first frame of a development build: the main thread's copy leaves out Svelte's development
// checks, which hold Lynx's elements to HTML's nesting rules, and draws what the background's
// development copy hydrates.

import { afterEach, describe, expect, it } from "@rstest/core";

import { readGlobal } from "../../src/testing/globals.ts";
import { FIRST_FRAME_GLOBAL } from "../../src/wire/index.ts";
import drawFrameInView from "../fixtures/threads/FrameInView.svelte?first-frame";

const logged: unknown[][] = [];
const { error } = console;
afterEach(() => {
	console.error = error;
	logged.length = 0;
});

describe("a development build's first frame", () => {
	it("draws a <frame> in a <view> with nothing said about HTML's nesting rules", () => {
		console.error = (...args: unknown[]) => void logged.push(args);
		drawFrameInView();
		const markup = (readGlobal(FIRST_FRAME_GLOBAL) as (data: object) => string)({});
		expect(markup).toBe(
			`<!--[--><view class="outer"><frame class="framed" src="inner.lynx.bundle"></frame><!----></view><!--]-->`,
		);
		expect(logged).toEqual([]);
	});
});
