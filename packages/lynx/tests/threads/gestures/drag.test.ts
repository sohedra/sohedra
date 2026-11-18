// A pan on an element: `main-thread:gesture` sets one detector of Lynx's for it, whose callbacks
// run on the main thread with the gesture's event and the state manager of their own detector.

import { describe, expect, it } from "@rstest/core";

import Drag from "../../fixtures/threads/gestures/Drag.svelte";
import drawDrag from "../../fixtures/threads/gestures/Drag.svelte?first-frame";
import { startFunctionsPage } from "../functions/pages.ts";

async function drag(firstFrame = false) {
	const log: unknown[] = [];
	const api: Record<string, (value?: unknown) => void> = {};
	const page = startFunctionsPage(Drag, { draw: drawDrag, props: { log, api }, firstFrame });
	await page.settle();
	return { page, log, api };
}

describe("a pan", () => {
	it("sets one detector with its callbacks, config and relations", async () => {
		const { page } = await drag();
		const dragged = page.byClass("dragged");
		const [detector] = page.engine.detectors(dragged);
		expect(page.engine.detectors(dragged)).toHaveLength(1);
		expect(detector).toMatchObject({
			type: 0,
			config: { minDistance: 0 },
			relations: { waitFor: [], simultaneous: [], continueWith: [] },
		});
		expect(detector!.callbacks.map(({ name }) => name)).toEqual(["onBegin", "onUpdate", "onEnd"]);
		expect(page.engine.state(dragged).attrs).toEqual({ flatten: false });
		expect(page.errors).toEqual([]);
	});

	it("runs its callbacks with the gesture's event and its detector's state manager", async () => {
		const { page, log } = await drag();
		const dragged = page.byClass("dragged");
		const id = page.engine.detectors(dragged)[0]!.id;
		page.engine.fireGesture(dragged, { id, callback: "onBegin", params: { x: 3 } });
		page.engine.fireGesture(dragged, { id, callback: "onUpdate", params: { x: 12 } });
		expect(page.engine.detectors(dragged)[0]!.state).toBe(1);
		expect(page.engine.state(dragged).inlineStyles.get("transform")).toBe("translateX(12px)");
		page.engine.fireGesture(dragged, { id, callback: "onEnd" });
		await page.settle();
		expect(page.engine.detectors(dragged)[0]!.state).toBe(3);
		expect(log).toEqual([
			["begin", "a", 3],
			["update", "a", 1],
			["end", "a"],
		]);
		expect(page.errors).toEqual([]);
	});
});

/** The `__SetGestureDetector` and `__RemoveGestureDetector` calls on an element, as `op id`. */
function calls(page: Awaited<ReturnType<typeof drag>>["page"], token: string): string[] {
	const element = page.byClass(token);
	return page.engine.gestureCalls
		.filter((call) => call.element === element)
		.map((call) => `${call.op} ${call.id}`);
}

describe("a pan built again", () => {
	it("keeps its detector and a drag in progress when only its callbacks' captures change", async () => {
		const { page, log, api } = await drag();
		const dragged = page.byClass("dragged");
		const id = page.engine.detectors(dragged)[0]!.id;
		const before = calls(page, "dragged");
		page.engine.fireGesture(dragged, { id, callback: "onBegin", params: { x: 1 } });
		page.asBackground(() => api["label"]!("b"));
		await page.settle();
		page.engine.fireGesture(dragged, { id, callback: "onUpdate", params: { x: 5 } });
		await page.settle();
		// No detector set or removed: the drag the engine recognized goes on, with the new callbacks.
		expect(calls(page, "dragged")).toEqual(before);
		expect(page.engine.detectors(dragged)[0]!.state).toBe(1);
		expect(log).toEqual([
			["begin", "a", 1],
			["update", "b", 1],
		]);
		expect(page.errors).toEqual([]);
	});

	it("sets its detector again, under the same id, when its options change: a drag ends", async () => {
		const { page, api } = await drag();
		const dragged = page.byClass("dragged");
		const id = page.engine.detectors(dragged)[0]!.id;
		page.engine.fireGesture(dragged, { id, callback: "onBegin" });
		page.asBackground(() => api["distance"]!(8));
		await page.settle();
		expect(calls(page, "dragged")).toEqual([`set ${id}`, `remove ${id}`, `set ${id}`]);
		const [detector] = page.engine.detectors(dragged);
		expect(detector).toMatchObject({ id, config: { minDistance: 8 } });
		expect(detector!.state).toBeUndefined();
	});

	it("sets its detector again when its type changes, and removes it when it goes", async () => {
		const { page, api } = await drag();
		const dragged = page.byClass("dragged");
		const id = page.engine.detectors(dragged)[0]!.id;
		page.asBackground(() => api["tap"]!());
		await page.settle();
		expect(page.engine.detectors(dragged)).toMatchObject([{ id, type: 3 }]);
		page.asBackground(() => api["hide"]!());
		await page.settle();
		expect(page.engine.detectors(dragged)).toEqual([]);
		expect(calls(page, "dragged")).toEqual([
			`set ${id}`,
			`remove ${id}`,
			`set ${id}`,
			`remove ${id}`,
		]);
		// The element keeps the view of its own it was given.
		expect(page.engine.state(dragged).attrs).toEqual({ flatten: false });
		expect(page.runtime.page.functions.sizes()).toMatchObject({ detectors: 0, gestureIds: 0 });
		page.asBackground(() => api["show"]!());
		await page.settle();
		expect(page.engine.detectors(dragged)).toHaveLength(1);
		expect(page.errors).toEqual([]);
	});
});

describe("a pan in the first frame", () => {
	it("is set as the frame is drawn, and a drag begun there goes on across hydration", async () => {
		const log: unknown[] = [];
		const api: Record<string, (value?: unknown) => void> = {};
		const page = startFunctionsPage(Drag, {
			draw: drawDrag,
			props: { log, api },
			firstFrame: true,
		});
		const dragged = page.byClass("dragged");
		const [detector] = page.engine.detectors(dragged);
		expect(detector).toMatchObject({ type: 0, config: { minDistance: 0 } });
		const id = detector!.id;
		page.engine.fireGesture(dragged, { id, callback: "onBegin", params: { x: 2 } });
		page.engine.fireGesture(dragged, { id, callback: "onUpdate", params: { x: 4 } });
		expect(page.engine.state(dragged).inlineStyles.get("transform")).toBe("translateX(4px)");
		await page.settle();
		expect(page.byClass("dragged")).toBe(dragged);
		// Hydration set nothing again: the drag Lynx recognized goes on.
		expect(calls(page, "dragged")).toEqual([`set ${id}`]);
		expect(page.engine.detectors(dragged)[0]!.state).toBe(1);
		page.engine.fireGesture(dragged, { id, callback: "onUpdate", params: { x: 9 } });
		await page.settle();
		// The background's callbacks run, with what the first frame's counted in the ref.
		expect(log).toEqual([
			["begin", "a", 2],
			["update", "a", 1],
			["update", "a", 2],
		]);
		expect(page.errors).toEqual([]);
	});
});
