// A text beside an element only the background renders, in a `<text>`
// (`{#if background}<text>B</text>{/if}{label}`): the element made in place goes before the text
// that follows it, as on a page drawn with no first frame.

import { describe, expect, it } from "@rstest/core";
import type { Component } from "svelte";

import FrameBadgeBefore from "../../fixtures/threads/FrameBadgeBefore.svelte";
import drawFrameBadgeBefore from "../../fixtures/threads/FrameBadgeBefore.svelte?first-frame";
import FrameBadgeMid from "../../fixtures/threads/FrameBadgeMid.svelte";
import drawFrameBadgeMid from "../../fixtures/threads/FrameBadgeMid.svelte?first-frame";
import { startSveltePage } from "../svelte-page.ts";

const SHAPES: [
	string,
	Component<Record<string, unknown>>,
	(props?: Record<string, unknown>) => void,
	string,
][] = [
	["before a text", FrameBadgeBefore, drawFrameBadgeBefore, "Blabel"],
	["before a text and an element", FrameBadgeMid, drawFrameBadgeMid, "BAx"],
];

describe.each(SHAPES)("a background-only element %s", (_, App, draw, shown) => {
	it("shows in its place on a page with no first frame", async () => {
		const page = startSveltePage(App);
		await page.settle();
		expect(page.engine.text(page.byClass("t"))).toBe(shown);
	});

	it("is made in its place by hydration, with no mismatch", async () => {
		const page = startSveltePage(App, { firstFrame: { draw } });
		await page.settle();
		expect(page.errors).toEqual([]);
		expect(page.engine.text(page.byClass("t"))).toBe(shown);
	});
});
