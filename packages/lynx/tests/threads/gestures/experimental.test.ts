// The experimental gestures on both threads: each sets its detector of its type, its callbacks run
// with its state manager, and `continueWith` names the gestures that take over.

import { describe, expect, it } from "@rstest/core";

import Experimental from "../../fixtures/threads/gestures/Experimental.svelte";
import drawExperimental from "../../fixtures/threads/gestures/Experimental.svelte?first-frame";
import { startFunctionsPage } from "../functions/pages.ts";

describe("an experimental gesture", () => {
	it("sets its detector of its type, and runs its callbacks", async () => {
		const log: unknown[] = [];
		const page = startFunctionsPage(Experimental, {
			draw: drawExperimental,
			props: { log },
			firstFrame: true,
		});
		await page.settle();
		const fired = [
			["fling", 1, "onUpdate"],
			["native", 7, "onBegin"],
			["press", 4, "onStart"],
			["hands-on", 0, "onEnd"],
		] as const;
		for (const [token, type, callback] of fired) {
			const element = page.byClass(token);
			const [detector] = page.engine.detectors(element);
			expect(detector!.type, token).toBe(type);
			page.engine.fireGesture(element, { id: detector!.id, callback, params: { x: type } });
			expect(page.engine.detectors(element)[0]!.state, token).toBe(1);
		}
		await page.settle();
		expect(log).toEqual([
			["onUpdate", 1],
			["onBegin", 7],
			["onStart", 4],
			["onEnd", 0],
		]);
		expect(page.engine.detectors(page.byClass("press"))[0]!.config).toEqual({
			minDuration: 300,
			maxDistance: 10,
		});
		expect(page.engine.detectors(page.byClass("hands-on"))[0]!.relations).toEqual({
			waitFor: [],
			simultaneous: [],
			continueWith: [page.engine.detectors(page.byClass("fling"))[0]!.id],
		});
		expect(page.errors).toEqual([]);
	});
});
