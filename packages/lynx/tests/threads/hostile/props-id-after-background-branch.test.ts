// `$props.id()` in a component after `{#if background}` that renders another of it: the branch's
// component takes the background's own id (`lynx-b1`), so the one after it has the first frame's id
// on both threads, and hydration writes nothing over it.

import { expect, it } from "@rstest/core";

import FrameIdShift from "../../fixtures/threads/FrameIdShift.svelte";
import drawFrameIdShift from "../../fixtures/threads/FrameIdShift.svelte?first-frame";
import { startSveltePage } from "../svelte-page.ts";

it("hydrates with the first frame's ids, and no mismatch", async () => {
	const page = startSveltePage(FrameIdShift, { firstFrame: { draw: drawFrameIdShift } });
	const drawn = page.byClass("labeled");
	await page.settle();
	expect(page.errors).toEqual([]);
	const ids = page.engine
		.all()
		.filter((element) => page.engine.state(element).classes === "labeled")
		.map((element) => page.engine.state(element).id);
	expect(ids).toEqual(["lynx-b1", "lynx-s1"]);
	expect(page.engine.all()).toContain(drawn);
	expect(page.engine.state(drawn).id).toBe("lynx-s1");
	expect(page.engine.state(drawn).attrs["accessibility-label"]).toBe("label-lynx-s1");
	expect(page.messages.some((message) => message.t === "props-ids")).toBe(false);
});
