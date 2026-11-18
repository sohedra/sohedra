// A gesture detector the engine refuses as it is set: the error is reported, the page's other
// detectors are set, the page holds none for it, and the gesture built again is set.

import { describe, expect, it } from "@rstest/core";

import Relations from "../../fixtures/threads/gestures/Relations.svelte";
import drawRelations from "../../fixtures/threads/gestures/Relations.svelte?first-frame";
import { startFunctionsPage } from "../functions/pages.ts";
import { expectNoStrayDetectors } from "../gestures/detectors.ts";
import type { SveltePage } from "../svelte-page.ts";

const detectors = (page: SveltePage, token: string) => page.engine.detectors(page.byClass(token));
const only = (page: SveltePage, token: string) => detectors(page, token)[0]!;

describe("a detector the engine refuses", () => {
	it("is reported, and leaves the others set and the page holding only what the engine has", async () => {
		const api: Record<string, () => void> = {};
		let sets = 0;
		const page = startFunctionsPage(Relations, {
			draw: drawRelations,
			props: { api },
			firstFrame: false,
		});
		const functions = page.engine.functions;
		const set = functions.__SetGestureDetector.bind(functions);
		functions.__SetGestureDetector = (...args) => {
			if (++sets === 2) throw new Error("The engine refused the detector.");
			set(...args);
		};
		await page.settle();
		expect(page.errors).toEqual([
			expect.objectContaining({ message: "The engine refused the detector." }),
		]);
		// The second detector set was the outer pan's; the rest of the page's are set.
		expect(detectors(page, "outer")).toEqual([]);
		expect(detectors(page, "three")).toHaveLength(3);
		expectNoStrayDetectors(page, "after the engine refused one");
		// Built again, it is set.
		page.asBackground(() => api["far"]!());
		await page.settle();
		expect(only(page, "outer").config).toEqual({ minDistance: 1 });
		expect(only(page, "inner").relations).toMatchObject({ waitFor: [only(page, "outer").id] });
		page.asBackground(() => api["toggle"]!());
		await page.settle();
		expectNoStrayDetectors(page, "after a part went");
	});
});
