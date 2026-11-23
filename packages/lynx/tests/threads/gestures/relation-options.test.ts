// The experimental relation options, `waitFor` and `continueWith`: they reach Lynx's detectors by
// the ids Lynx knows the gestures by, from the first frame on, and a development build warns once
// for each, from the background only, however many gestures take it and however often they are
// built again.

import { describe, expect, it } from "@rstest/core";

import ExperimentalRelations from "../../fixtures/threads/gestures/ExperimentalRelations.svelte";
import drawExperimentalRelations from "../../fixtures/threads/gestures/ExperimentalRelations.svelte?first-frame";
import { startFunctionsPage } from "../functions/pages.ts";
import type { SveltePage } from "../svelte-page.ts";

const only = (page: SveltePage, token: string) => page.engine.detectors(page.byClass(token))[0]!;

describe("the relation options", () => {
	it("reach the engine from the first frame, and warn once each that they are experimental", async () => {
		const api: Record<string, () => void> = {};
		const page = startFunctionsPage(ExperimentalRelations, {
			draw: drawExperimentalRelations,
			props: { api },
			firstFrame: true,
		});
		const outer = only(page, "outer").id;
		const fling = only(page, "fling").id;
		expect(only(page, "inner").relations).toEqual({
			waitFor: [outer],
			simultaneous: [],
			continueWith: [],
		});
		expect(only(page, "hands-on").relations).toEqual({
			waitFor: [],
			simultaneous: [],
			continueWith: [fling],
		});
		await page.settle();
		page.asBackground(() => api["far"]!());
		await page.settle();
		expect(only(page, "inner").relations).toMatchObject({ waitFor: [outer] });
		expect(only(page, "other").relations).toMatchObject({ waitFor: [outer] });
		expect(only(page, "hands-on").relations).toMatchObject({ continueWith: [fling] });
		// Once each, though both threads built the gestures, and the background built them twice.
		expect(page.warnings).toEqual([
			expect.objectContaining({
				code: "gesture_relation_experimental",
				message: expect.stringMatching(/^The waitFor of a TapGesture is experimental/),
			}),
			expect.objectContaining({
				code: "gesture_relation_experimental",
				message: expect.stringMatching(/^The continueWith of a PanGesture is experimental/),
			}),
		]);
		expect(page.errors).toEqual([]);
	});
});
