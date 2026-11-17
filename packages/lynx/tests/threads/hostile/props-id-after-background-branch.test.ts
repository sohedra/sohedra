// `$props.id()` in a component after `{#if background}` that renders another of it: the background
// gives one more id than the first frame did, so the frame's ids are written over with the
// background's, and nothing is reported.

import { expect, it } from "@rstest/core";

import FrameIdShift from "../../fixtures/threads/FrameIdShift.svelte";
import drawFrameIdShift from "../../fixtures/threads/FrameIdShift.svelte?first-frame";
import { startSveltePage } from "../svelte-page.ts";

it("hydrates with the background's ids, and no mismatch", async () => {
	const page = startSveltePage(FrameIdShift, { firstFrame: { draw: drawFrameIdShift } });
	const drawn = page.byClass("labeled");
	await page.settle();
	expect(page.errors).toEqual([]);
	const ids = page.engine
		.all()
		.filter((element) => page.engine.state(element).classes === "labeled")
		.map((element) => page.engine.state(element).id);
	expect(ids).toEqual(["lynx-s1", "lynx-s2"]);
	expect(page.engine.all()).toContain(drawn);
	expect(page.engine.state(drawn).id).toBe("lynx-s2");
	expect(page.engine.state(drawn).attrs["accessibility-label"]).toBe("label-lynx-s2");
});
