// Driving an element's gesture in a test: `lynx.gesture(element)` runs its callbacks on the main
// thread as Lynx does when a finger moves, with the gesture's values and its time.

import { expect, it } from "@rstest/core";
import { render } from "@sohedra/lynx/testing";

import Swipe from "../fixtures/library/Swipe.svelte";

async function setup() {
	const log: unknown[] = [];
	const page = await render(Swipe, { props: { log } });
	const element = (name: string) => page.container.querySelector(`.${name}`)!;
	return { ...page, log, element };
}

it("runs a pan's callbacks with their values and times, and the element follows", async () => {
	const { lynx, log, element } = await setup();
	const pan = lynx.gesture(element("sheet"));
	await pan.fire("onBegin", { params: { x: 0, y: 0 }, timestamp: 1000 });
	await pan.fire("onUpdate", { params: { x: 40, y: 0 }, timestamp: 1016 });
	expect((element("sheet") as HTMLElement).style.transform).toBe("translateX(40px)");
	await pan.fire("onEnd", { params: { x: 40, y: 0 }, timestamp: 1032 });
	expect(log).toEqual(["begin 0 at 1000", "end at 1032"]);
});

it("picks one of an element's gestures by its kind", async () => {
	const { lynx, log, element } = await setup();
	await lynx.gesture(element("both"), "tap").fire("onEnd");
	expect(log).toEqual(["tap"]);
	expect(() => lynx.gesture(element("both"))).toThrow(
		"The <view> has several gestures (pan, tap), and lynx.gesture was not told which to run.",
	);
});

it("says what is missing: a gesture, or a callback", async () => {
	const { lynx, element, container } = await setup();
	expect(() => lynx.gesture(container.querySelector("text")!)).toThrow(
		"The <text> has no gesture for lynx.gesture to run.",
	);
	expect(() => lynx.gesture(element("sheet"), "tap")).toThrow(
		"The <view> has no tap gesture for lynx.gesture to run.",
	);
	await expect(lynx.gesture(element("sheet")).fire("onSwipe")).rejects.toThrow(
		"The pan gesture on the <view> has no onSwipe callback to run.",
	);
});
