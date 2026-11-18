// `finished` of an animation: a promise, as in the Web Animations API, that resolves when the
// animation ends by itself or through `finish()`, and rejects with an AbortError when it is
// canceled. The engine says an animation ended (`animationend`, `animationcancel`, with the
// animation's name) only to an element that listens: so the listeners are added when `finished`
// is read, and removed when it settles.

import { describe, expect, it } from "@rstest/core";

import type { ElementNode } from "../../src/background/renderer/element.ts";
import Animated from "../fixtures/threads/Animated.svelte";
import { startSveltePage } from "./svelte-page.ts";

const KEYFRAMES = [{ opacity: 0 }, { opacity: 1 }];

async function animated() {
	const handles: Record<string, unknown> = {};
	const page = startSveltePage(Animated, { props: () => ({ handles }) });
	await page.settle();
	const box = () => page.byClass("box");
	const animate = (duration = 100) =>
		page.asBackground(() => (handles["box"] as ElementNode).animate(KEYFRAMES, duration));
	const listening = () =>
		page.engine
			.state(box())
			.listeners.map((listener) => listener.name)
			.sort();
	/** Whether the promise has settled, once the threads have delivered. */
	const state = async (promise: Promise<unknown>) => {
		let result = "pending";
		promise.then(
			() => (result = "resolved"),
			() => (result = "rejected"),
		);
		await page.settle();
		return result;
	};
	return { page, box, animate, listening, state };
}

describe("finished", () => {
	it("listens to nothing, and sends nothing, until it is read", async () => {
		const { page, box, animate, listening } = await animated();
		const sent = page.patches.length;
		const animation = animate();
		await page.settle();
		expect(listening()).toEqual([]);
		expect(JSON.stringify(page.patches.slice(sent))).not.toContain("animationend");
		expect(page.engine.endAnimation(box(), animation.id)).toBe(false);
	});

	it("resolves when the engine says the animation ended, and stops listening", async () => {
		const { page, box, animate, listening, state } = await animated();
		const animation = animate();
		const finished = animation.finished;
		expect(animation.finished).toBe(finished);
		await page.settle();
		expect(listening()).toEqual(["animationcancel", "animationend"]);
		expect(await state(finished)).toBe("pending");
		expect(page.engine.endAnimation(box(), animation.id)).toBe(true);
		expect(await state(finished)).toBe("resolved");
		expect(listening()).toEqual([]);
	});

	it("is not settled by the end of another animation of the element", async () => {
		const { page, box, animate, listening, state } = await animated();
		const first = animate(100);
		const second = animate(200);
		const [firstDone, secondDone] = [first.finished, second.finished];
		await page.settle();
		page.engine.endAnimation(box(), second.id);
		expect(await state(secondDone)).toBe("resolved");
		expect(await state(firstDone)).toBe("pending");
		expect(listening()).toEqual(["animationcancel", "animationend"]);
		page.engine.endAnimation(box(), first.id);
		expect(await state(firstDone)).toBe("resolved");
		expect(listening()).toEqual([]);
	});

	it("resolves through finish(), which ends the animation in the engine", async () => {
		const { page, box, animate, listening, state } = await animated();
		const animation = animate();
		const finished = animation.finished;
		await page.settle();
		page.asBackground(() => animation.finish());
		expect(await state(finished)).toBe("resolved");
		expect(listening()).toEqual([]);
		expect(page.engine.state(box()).running.size).toBe(0);
		expect(page.engine.animations.at(-1)!.args).toEqual([4, animation.id]);
	});

	it("is resolved already when read after finish()", async () => {
		const { animate, listening, state } = await animated();
		const animation = animate();
		animation.finish();
		expect(await state(animation.finished)).toBe("resolved");
		expect(listening()).toEqual([]);
	});

	it("rejects with an AbortError through cancel()", async () => {
		const { page, animate, listening } = await animated();
		const animation = animate();
		const finished = animation.finished;
		await page.settle();
		page.asBackground(() => animation.cancel());
		await expect(finished).rejects.toMatchObject({
			name: "AbortError",
			code: "animation_canceled",
			message: expect.stringMatching(/^The animation of the <view> was canceled/),
		});
		await page.settle();
		expect(listening()).toEqual([]);
	});

	it("rejects when the engine cancels the animation", async () => {
		const { page, box, animate, listening } = await animated();
		const animation = animate();
		const finished = animation.finished;
		await page.settle();
		page.engine.cancelAnimation(box(), animation.id);
		await expect(finished).rejects.toMatchObject({ name: "AbortError" });
		await page.settle();
		expect(listening()).toEqual([]);
	});

	it("names an animation in its message only when the app named it", async () => {
		const { page, animate } = await animated();
		const named = page.asBackground(() =>
			animate().effect.target.animate(KEYFRAMES, { name: "fade", duration: 100 }),
		);
		named.cancel();
		await expect(named.finished).rejects.toMatchObject({
			message: expect.stringMatching(/^The animation fade of the <view> was canceled/),
		});
		const unnamed = animate();
		unnamed.cancel();
		await expect(unnamed.finished).rejects.toMatchObject({
			message: expect.not.stringContaining(unnamed.id),
		});
	});

	it("is rejected already when read after cancel()", async () => {
		const { animate } = await animated();
		const animation = animate();
		animation.cancel();
		await expect(animation.finished).rejects.toMatchObject({ name: "AbortError" });
	});

	it("raises no error when it is read, canceled and never caught", async () => {
		const { page, animate } = await animated();
		const animation = animate();
		void animation.finished;
		await page.settle();
		page.asBackground(() => animation.cancel());
		await page.settle();
		expect(page.errors).toEqual([]);
	});
});
