// The page's root given to createStaticCopy as the source, as a route transition that keeps the
// outgoing page on screen might try: refused with one error, and nothing is made, instead of a
// second page element.

import { describe, expect, it } from "@rstest/core";
import type { LynxNode } from "@sohedra/lynx/elements";

import { createStaticCopy, root } from "../../../src/background/root-entry.ts";
import CopySource from "../../fixtures/threads/page/CopySource.svelte";
import drawCopySource from "../../fixtures/threads/page/CopySource.svelte?first-frame";
import { startSveltePage } from "../svelte-page.ts";

describe("the page's root as a static copy's source", () => {
	it("is refused, and nothing is made", async () => {
		const handles: Record<string, unknown> = { taps: 0 };
		// The source's first-frame copy registers its main-thread handler; no frame is drawn.
		void drawCopySource;
		const page = startSveltePage(CopySource, { props: { handles } });
		await page.settle();
		const patches = page.patches.length;
		let thrown: unknown;
		try {
			page.asBackground(() => createStaticCopy(root, handles["holder"] as LynxNode));
		} catch (error) {
			thrown = error;
		}
		expect(thrown).toMatchObject({
			code: "static_copy_page_root",
			message: expect.stringMatching(/^The page's root was given to createStaticCopy/),
		});
		await page.settle();
		expect(page.patches).toHaveLength(patches);
		expect(page.engine.madeCount("page")).toBe(1);
		expect(page.errors).toEqual([]);
	});
});
