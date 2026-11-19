// A component's `$props.id()` after a component only the background renders, its id referenced
// across components (a label's `id`, an input's `aria-labelledby`): the first frame draws them with
// the ids the background gives, so the reference holds before hydration and after, and hydration
// neither reports nor writes anything.

import { expect, it } from "@rstest/core";

import FrameIdRefs from "../../fixtures/threads/FrameIdRefs.svelte";
import drawFrameIdRefs from "../../fixtures/threads/FrameIdRefs.svelte?first-frame";
import { startSveltePage } from "../svelte-page.ts";

it("keeps the reference from the first frame on, with nothing reported or written", async () => {
	const page = startSveltePage(FrameIdRefs, { firstFrame: { draw: drawFrameIdRefs } });
	const label = page.byClass("field-label");
	const input = page.byClass("field-input");
	expect(page.engine.state(label).id).toBe("lynx-s1");
	expect(page.engine.state(input).attrs["aria-labelledby"]).toBe("lynx-s1");
	await page.settle();
	expect(page.errors).toEqual([]);
	expect(page.warnings).toEqual([]);
	expect(page.messages.some((message) => message.t === "props-ids")).toBe(false);
	expect(page.byClass("field-label")).toBe(label);
	expect(page.byClass("field-input")).toBe(input);
	expect(page.engine.state(label).id).toBe("lynx-s1");
	expect(page.engine.state(input).attrs["aria-labelledby"]).toBe("lynx-s1");
	// The component only the background renders took the background's own id.
	expect(page.engine.state(page.byClass("labeled")).id).toBe("lynx-b1");
});
