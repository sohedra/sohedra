// A gesture's callbacks, from the engine's call to what they do: Lynx runs a detector's callback
// with the gesture's event and its gesture manager, and the callback gets its own detector's state
// manager, made once with the detector. Nothing is written into what a callback captured.

import { describe, expect, it } from "@rstest/core";

import Callbacks from "../../fixtures/threads/gestures/Callbacks.svelte";
import drawCallbacks from "../../fixtures/threads/gestures/Callbacks.svelte?first-frame";
import { startFunctionsPage } from "../functions/pages.ts";

const PAN = 0;
const TAP = 3;
// The gesture manager's states (FiberSetGestureState): active, fail, end.
const ACTIVE = 1;
const FAIL = 2;
const END = 3;

async function callbacks(firstFrame = false) {
	const log: unknown[] = [];
	const page = startFunctionsPage(Callbacks, { draw: drawCallbacks, props: { log }, firstFrame });
	await page.settle();
	const surface = page.byClass("surface");
	const detector = (type: number) =>
		page.engine.detectors(surface).find((entry) => entry.type === type)!;
	/** Lynx runs a callback of the surface's detector of this type. */
	const run = async (type: number, name: string, params: Record<string, unknown> = {}) => {
		page.engine.fireGesture(surface, { id: detector(type).id, callback: name, params });
		await page.settle();
	};
	return { page, log, surface, detector, run };
}

describe("a gesture's callbacks", () => {
	it("are set on the element's detectors, one per gesture, with the composition's relations", async () => {
		const { page, surface, detector } = await callbacks();
		expect(
			page.engine
				.detectors(surface)
				.map((entry) => [entry.type, entry.callbacks.map((c) => c.name)]),
		).toEqual([
			[PAN, ["onBegin", "onEnd"]],
			[TAP, ["onStart", "onEnd"]],
		]);
		expect(detector(PAN).relations).toEqual({
			waitFor: [],
			simultaneous: [detector(TAP).id],
			continueWith: [],
		});
		expect(detector(TAP).relations).toEqual({
			waitFor: [],
			simultaneous: [detector(PAN).id],
			continueWith: [],
		});
	});

	it("run with the gesture's event, its values in params and the element in currentTarget", async () => {
		const { page, log, surface, run } = await callbacks();
		await run(PAN, "onBegin", { pageX: 12 });
		expect(log).toEqual([["pan begin", 12, "mine", 7, "state"]]);
		expect(page.engine.state(surface).inlineStyles.get("opacity")).toBe("0.5");
		expect(page.errors).toEqual([]);
	});

	it("move their own detector, by the id Lynx knows it by, through the engine's manager", async () => {
		const { page, surface, detector, run } = await callbacks();
		await run(PAN, "onBegin");
		expect([detector(PAN).state, detector(TAP).state]).toEqual([ACTIVE, undefined]);
		await run(TAP, "onStart");
		expect([detector(PAN).state, detector(TAP).state]).toEqual([ACTIVE, FAIL]);
		await run(PAN, "onEnd");
		expect([detector(PAN).state, detector(TAP).state]).toEqual([END, FAIL]);
		await run(TAP, "onEnd");
		expect(detector(TAP).consume).toEqual({ consume: false, inner: false });
		expect(
			page.engine.gestureManagerCalls
				.filter((call) => call.op === "consume")
				.map(({ element, id, params }) => [element === surface, id, params]),
		).toEqual([
			[true, detector(TAP).id, { consume: true, inner: true }],
			[true, detector(TAP).id, { consume: false, inner: false }],
		]);
		expect(page.errors).toEqual([]);
	});

	it("work from the first frame, with the first frame's copies", async () => {
		const log: unknown[] = [];
		const page = startFunctionsPage(Callbacks, {
			draw: drawCallbacks,
			props: { log },
			firstFrame: true,
		});
		const surface = page.byClass("surface");
		const pan = page.engine.detectors(surface).find((entry) => entry.type === PAN)!;
		page.engine.fireGesture(surface, { id: pan.id, callback: "onBegin", params: { pageX: 5 } });
		expect(pan.state).toBe(ACTIVE);
		await page.settle();
		expect(log).toEqual([["pan begin", 5, "mine", 7, "state"]]);
		expect(page.errors).toEqual([]);
	});
});

describe("an edge-only pan", () => {
	it("gives the touch up in onBegin away from the edge, and takes it near the edge", async () => {
		const { page, log } = await callbacks();
		const edge = page.byClass("edge");
		const [detector] = page.engine.detectors(edge);
		page.engine.fireGesture(edge, { id: detector!.id, callback: "onBegin", params: { x: 80 } });
		expect(page.engine.detectors(edge)[0]!.state).toBe(FAIL);
		page.engine.fireGesture(edge, { id: detector!.id, callback: "onBegin", params: { x: 6 } });
		expect(page.engine.detectors(edge)[0]!.state).toBe(ACTIVE);
		await page.settle();
		expect(log).toEqual([["edge", 6]]);
		expect(page.errors).toEqual([]);
	});
});
