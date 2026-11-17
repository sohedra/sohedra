// A gesture detector as the engine holds it, and a gesture's callbacks as it runs them.

import { describe, expect, it } from "@rstest/core";

import { engineForEach, runWorkletRecorder, smallPage } from "./engine-fixture.ts";

const engine = engineForEach();
const worklets = runWorkletRecorder();

const RELATIONS = { waitFor: [], simultaneous: [], continueWith: [] };

/** A page with a detector (id 7) on `inner`, with an `onBegin` callback. */
function detector() {
	const made = smallPage(engine());
	engine().functions.__SetDataset(made.inner, { row: 3 });
	const onBegin = { label: "begin" };
	engine().functions.__SetGestureDetector(
		made.inner,
		7,
		0,
		{ callbacks: [{ name: "onBegin", callback: onBegin }], config: { minDistance: 4 } },
		RELATIONS,
	);
	return { ...made, onBegin };
}

describe("a detector set with __SetGestureDetector", () => {
	it("runs runWorklet(callback, [event, gestureManager], { source: 2 })", () => {
		const { inner, onBegin } = detector();
		worklets.returns.set(onBegin, "returned");
		expect(engine().fireGesture(inner, { id: 7, callback: "onBegin", params: { pageX: 12 } })).toBe(
			"returned",
		);
		expect(worklets.calls).toHaveLength(1);
		expect(worklets.calls[0]!.value).toBe(onBegin);
		expect(worklets.calls[0]!.options).toEqual({ source: 2 });
		const [event, manager] = worklets.calls[0]!.params as [
			Record<string, unknown>,
			Record<string, unknown>,
		];
		const target = { id: "inner", uid: 3, dataset: { row: 3 }, elementRefptr: inner };
		expect(event).toEqual({
			type: "onBegin",
			timestamp: expect.any(Number),
			params: { pageX: 12 },
			detail: { pageX: 12 },
			target,
			currentTarget: target,
		});
		expect(Object.keys(manager).toSorted()).toEqual(["__ConsumeGesture", "__SetGestureState"]);
		expect(engine().mainThreadRuns).toEqual([
			{ source: "gesture", element: inner, name: "onBegin", eventReturnResult: 0 },
		]);
	});

	it("has a manager that moves the detector with that id on that element, and no other", () => {
		const { outer, inner } = detector();
		type Manager = {
			__SetGestureState(element: unknown, id: number, state: number): void;
			__ConsumeGesture(element: unknown, id: number, params: unknown): void;
		};
		worklets.use((_value, [, manager]) => {
			const gestures = manager as Manager;
			gestures.__SetGestureState(inner, 7, 1);
			gestures.__ConsumeGesture(inner, 7, { consume: true, inner: true });
			// Lynx finds no detector for these, and does nothing.
			gestures.__SetGestureState(inner, 8, 2);
			gestures.__SetGestureState(outer, 7, 3);
		});
		engine().fireGesture(inner, { id: 7, callback: "onBegin" });
		expect(engine().detectors(inner)).toEqual([
			expect.objectContaining({ id: 7, state: 1, consume: { consume: true, inner: true } }),
		]);
		expect(engine().gestureManagerCalls.map((call) => call.detector)).toEqual([
			true,
			true,
			false,
			false,
		]);
	});

	it("is gone after __RemoveGestureDetector, and has only the callbacks it was given", () => {
		const { inner } = detector();
		expect(() => engine().fireGesture(inner, { id: 7, callback: "onEnd" })).toThrow("has no onEnd");
		engine().functions.__RemoveGestureDetector(inner, 7);
		expect(() => engine().fireGesture(inner, { id: 7, callback: "onBegin" })).toThrow(
			"no gesture detector 7",
		);
		expect(worklets.calls).toEqual([]);
	});

	it("logs each set and removal, with the config as it was then", () => {
		const { inner } = detector();
		engine().functions.__RemoveGestureDetector(inner, 7);
		expect(engine().gestureCalls).toEqual([
			{
				op: "set",
				element: inner,
				id: 7,
				type: 0,
				config: {
					callbacks: [{ name: "onBegin", callback: { label: "begin" } }],
					config: { minDistance: 4 },
				},
				relations: RELATIONS,
			},
			{ op: "remove", element: inner, id: 7 },
		]);
	});

	it("refuses an id or a type that is not a number, as the engine does", () => {
		const { inner } = smallPage(engine());
		const f = engine().functions;
		expect(() =>
			f.__SetGestureDetector(inner, "7" as never, 0, { callbacks: [] }, RELATIONS),
		).toThrow("__SetGestureDetector param 1 should be a number");
		expect(() =>
			f.__SetGestureDetector(inner, 7, "pan" as never, { callbacks: [] }, RELATIONS),
		).toThrow("__SetGestureDetector param 2 should be a number");
	});

	it("sets nothing when the callbacks are not an array, as the engine does", () => {
		const { inner } = smallPage(engine());
		engine().functions.__SetGestureDetector(inner, 9, 0, { callbacks: "no" as never }, RELATIONS);
		expect(engine().detectors(inner)).toEqual([]);
	});

	it("lists an element's detectors in the order they were set", () => {
		const { inner } = detector();
		engine().functions.__SetGestureDetector(inner, 3, 1, { callbacks: [] }, RELATIONS);
		expect(
			engine()
				.detectors(inner)
				.map((entry) => entry.id),
		).toEqual([7, 3]);
	});

	it("makes the element need a view of its own: a detector stops it being flattened", async () => {
		const { page, inner } = detector();
		engine().flattenViews();
		engine().functions.__FlushElementTree(page);
		const answers: number[] = [];
		engine().functions.__InvokeUIMethod(inner, "boundingClientRect", {}, (result) =>
			answers.push(result.code),
		);
		await new Promise((resolve) => setImmediate(resolve));
		expect(answers).toEqual([0]);
	});
});
