// `__ElementAnimate`: an animation's life on an element, and the events the engine sends for it.

import { describe, expect, it } from "@rstest/core";

import { engineForEach, runWorkletRecorder, smallPage } from "./engine-fixture.ts";

const engine = engineForEach();

const FADE = [0, "fade", [{ opacity: 0 }, { opacity: 1 }], { duration: 300 }];

describe("an animation", () => {
	it("starts, pauses, plays again and is canceled, by its name", () => {
		const { inner } = smallPage(engine());
		const f = engine().functions;
		f.__ElementAnimate(inner, FADE);
		expect(engine().state(inner).running.get("fade")).toEqual({
			keyframes: [{ opacity: 0 }, { opacity: 1 }],
			options: { duration: 300 },
			state: "running",
		});
		f.__ElementAnimate(inner, [2, "fade"]);
		expect(engine().state(inner).running.get("fade")?.state).toBe("paused");
		f.__ElementAnimate(inner, [1, "fade"]);
		expect(engine().state(inner).running.get("fade")?.state).toBe("running");
		f.__ElementAnimate(inner, [3, "fade"]);
		expect(engine().state(inner).running.size).toBe(0);
		expect(engine().animations.map((call) => call.args[0])).toEqual([0, 2, 1, 3]);
	});

	it("ends at once when it is finished, and says nothing of it", () => {
		const { inner } = smallPage(engine());
		const f = engine().functions;
		const heard: unknown[] = [];
		f.__AddEventListener(inner, "animationend", (event) => heard.push(event), {});
		f.__AddEventListener(inner, "animationcancel", (event) => heard.push(event), {});
		f.__ElementAnimate(inner, FADE);
		f.__ElementAnimate(inner, [4, "fade"]);
		expect(engine().state(inner).running.size).toBe(0);
		expect(heard).toEqual([]);
		expect(() => f.__ElementAnimate(inner, [5, "fade"])).toThrow(/3 to cancel or 4 to finish/);
	});

	it("does nothing to a name that is not running", () => {
		const { inner } = smallPage(engine());
		const f = engine().functions;
		f.__ElementAnimate(inner, [2, "ghost"]);
		f.__ElementAnimate(inner, [1, "ghost"]);
		expect(engine().state(inner).running.size).toBe(0);
	});
});

describe("the engine's animation events", () => {
	it("sends animationcancel for a running or paused animation that is canceled, to a listener", () => {
		const { inner } = smallPage(engine());
		const f = engine().functions;
		const heard: unknown[] = [];
		f.__AddEventListener(inner, "animationcancel", (event) => heard.push(event), {});
		f.__ElementAnimate(inner, FADE);
		f.__ElementAnimate(inner, [3, "fade"]);
		f.__ElementAnimate(inner, [3, "fade"]);
		expect(heard).toHaveLength(1);
		expect(heard[0]).toMatchObject({
			type: "animationcancel",
			params: { animation_name: "fade", animation_type: "keyframe-animation", new_animator: true },
		});
	});

	it("sends nothing to an element that does not listen, and says so", () => {
		const { inner } = smallPage(engine());
		const f = engine().functions;
		f.__ElementAnimate(inner, FADE);
		expect(engine().endAnimation(inner, "fade")).toBe(false);
		f.__AddEventListener(inner, "animationend", () => {}, {});
		expect(engine().endAnimation(inner, "fade")).toBe(true);
		expect(engine().cancelAnimation(inner, "fade")).toBe(false);
	});
});

describe("an animation event to an __AddEvent binding", () => {
	const worklets = runWorkletRecorder();

	it("goes to a handler name, for the background", () => {
		const { inner } = smallPage(engine());
		const f = engine().functions;
		f.__AddEvent(inner, "bindEvent", "animationcancel", "onCancel");
		f.__ElementAnimate(inner, FADE);
		f.__ElementAnimate(inner, [3, "fade"]);
		expect(engine().backgroundEvents.map((sent) => [sent.eventName, sent.handler])).toEqual([
			["animationcancel", "onCancel"],
		]);
	});

	it("runs a main-thread function, with the animation's name and the time it ran", () => {
		const { inner } = smallPage(engine());
		const f = engine().functions;
		f.__AddEvent(inner, "bindEvent", "animationend", { type: "worklet", value: { n: 1 } });
		f.__ElementAnimate(inner, FADE);
		expect(engine().endAnimation(inner, "fade")).toBe(true);
		expect(worklets.calls).toHaveLength(1);
		expect((worklets.calls[0]!.params[0] as { params: unknown }).params).toEqual({
			animation_name: "fade",
			animation_type: "keyframe-animation",
			new_animator: true,
			elapsedTime: 0.3,
		});
	});
});

describe("an operation", () => {
	it("is one of the four Lynx knows; any other throws, where Lynx would ignore it", () => {
		const { inner } = smallPage(engine());
		expect(() => engine().functions.__ElementAnimate(inner, [7, "fade"])).toThrow(
			"__ElementAnimate was given the operation 7",
		);
	});
});

describe("forgetting an element", () => {
	it("drops what the logs kept of it and of what was under it, and keeps the rest", () => {
		const { page, outer, inner } = smallPage(engine());
		const f = engine().functions;
		const other = f.__CreateView(0);
		f.__AppendElement(page, other);
		f.__ElementAnimate(inner, FADE);
		f.__ElementAnimate(other, FADE);
		f.__InvokeUIMethod(inner, "boundingClientRect", {}, () => {});
		f.__RemoveElement(page, outer);
		engine().forget(f.__GetElementUniqueID(outer));
		expect(engine().animations.map((call) => call.element)).toEqual([other]);
		expect(engine().invocations).toEqual([]);
	});
});
