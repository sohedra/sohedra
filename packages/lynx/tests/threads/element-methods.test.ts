// An element's methods: a UI method, styles set from code, a computed style, queries and an
// animation reach the element's Lynx element on the main thread, after the ops made before them.

import { describe, expect, it } from "@rstest/core";

import type { ElementNode } from "../../src/background/renderer/element.ts";
import ElementMethods from "../fixtures/threads/ElementMethods.svelte";
import { startSveltePage } from "./svelte-page.ts";

async function methods() {
	const handles: Record<string, unknown> = {};
	const page = startSveltePage(ElementMethods, { props: () => ({ handles }) });
	await page.settle();
	const node = (name: string) => handles[name] as ElementNode;
	/**
	 * Runs `code` as the background's, and waits for both threads. What it returns comes in an
	 * array, so that a promise stays one.
	 */
	const background = async <T>(code: () => T): Promise<[T]> => {
		const value = page.asBackground(code);
		// Read later by the test, which then sees the rejection.
		if (value instanceof Promise) value.catch(() => {});
		await page.settle();
		return [value];
	};
	const tap = async (token: string) => {
		page.engine.dispatch(page.byClass(token), { type: "tap" });
		await page.settle();
	};
	return { page, handles, node, background, tap };
}

describe("invoke", () => {
	it("calls the UI method of the element, and resolves with what Lynx answers", async () => {
		const { page, node, background } = await methods();
		page.engine.respondWith(() => ({ code: 0, data: { scrolled: true } }));
		const [answer] = await background(() =>
			node("scroller").invoke("scrollTo", { offset: 120, smooth: true }),
		);
		await expect(answer).resolves.toEqual({ scrolled: true });
		expect(page.engine.invocations.at(-1)).toMatchObject({
			element: page.byClass("scroller"),
			method: "scrollTo",
			params: { offset: 120, smooth: true },
			code: 0,
		});
		expect(page.errors).toEqual([]);
	});

	it("rejects with Lynx's code when the method fails", async () => {
		const { page, node, background } = await methods();
		page.engine.respondWith(() => ({ code: 3 }));
		const [answer] = await background(() => node("scroller").invoke("scrollTo"));
		await expect(answer).rejects.toMatchObject({
			code: "ui_method_failed",
			message: expect.stringContaining("code 3"),
		});
		expect(page.errors).toEqual([]);
	});

	it("rides in the patch after the ops made before it, so it finds a new element", async () => {
		const { page, handles, tap } = await methods();
		page.engine.respondWith(() => ({ code: 0, data: { width: 10 } }));
		const sent = page.patches.length;
		await tap("add");
		const patches = page.patches.slice(sent);
		expect(patches).toHaveLength(1);
		const kinds = patches[0]!.items.map((item) => item[0]);
		expect(kinds.indexOf("call")).toBeGreaterThan(kinds.indexOf("ops"));
		expect(page.engine.invocations.map((call) => call.element)).toEqual([page.byClass("fresh")]);
		expect(handles["result-fresh"]).toEqual({ ok: { width: 10 } });
	});

	it("rejects for an element that is not on the page, and asks Lynx nothing", async () => {
		const { page, node, background, tap } = await methods();
		const doomed = node("doomed");
		await tap("doom");
		const [answer] = await background(() => doomed.invoke("boundingClientRect"));
		await expect(answer).rejects.toMatchObject({
			code: "element_not_on_page",
			message: expect.stringMatching(
				/<view> is not on the page.*\n.*ElementMethods\.svelte:\d+:\d+/,
			),
		});
		expect(page.engine.invocations).toEqual([]);
	});

	it("fails once, and calls nothing, on an element the same update removes", async () => {
		const { page, handles, tap } = await methods();
		await tap("doom");
		expect(handles["result-doomed"]).toEqual({ error: "element_left_page" });
		expect(handles["message-doomed"]).toMatch(/removed from the page in the same update/);
		expect(page.engine.invocations).toEqual([]);
		expect(page.errors).toEqual([]);
	});

	it("rejects once the page is gone", async () => {
		const { page, node } = await methods();
		const scroller = node("scroller");
		page.destroy();
		await page.settle();
		await expect(page.asBackground(() => scroller.invoke("scrollTo"))).rejects.toMatchObject({
			code: "page_is_gone",
		});
	});
});

describe("styles and queries", () => {
	it("sets styles from code, and reads a computed style", async () => {
		const { page, node, background } = await methods();
		await background(() => node("box").setStyleProperty("opacity", "0.5"));
		await background(() => node("box").setStyleProperties({ width: "4px", height: 3 }));
		const styles = page.engine.state(page.byClass("box")).inlineStyles;
		expect(Object.fromEntries(styles)).toEqual({ opacity: "0.5", width: "4px", height: "3" });
		const [opacity] = await background(() => node("box").getComputedStyleProperty("opacity"));
		await expect(opacity).resolves.toBe("0.5");
		expect(page.errors).toEqual([]);
	});

	it("reads a computed style after the update it follows is flushed", async () => {
		const { node, background } = await methods();
		const [opacity] = await background(() => {
			node("box").setStyleProperty("opacity", "0.7");
			return node("box").getComputedStyleProperty("opacity");
		});
		await expect(opacity).resolves.toBe("0.7");
	});

	it("keeps styles set on an element that is not on the page, and does not throw", async () => {
		const { page, node, tap } = await methods();
		const doomed = node("doomed");
		await tap("doom");
		expect(() => page.asBackground(() => doomed.setStyleProperty("opacity", 1))).not.toThrow();
		await page.settle();
		expect(page.errors).toEqual([]);
	});

	it("finds the element nodes under an element that a selector matches", async () => {
		const { node, background } = await methods();
		const [first] = await background(() => node("scroller").querySelector(".row"));
		await expect(first).resolves.toBe(node("first"));
		const [rows] = await background(() => node("scroller").querySelectorAll(".row"));
		await expect(rows).resolves.toHaveLength(2);
		const [none] = await background(() => node("scroller").querySelector(".missing"));
		await expect(none).resolves.toBeNull();
	});
});

describe("animate", () => {
	it("starts an animation with the engine's option names, and controls it by its name", async () => {
		const { page, node, background } = await methods();
		const [animation] = await background(() =>
			node("box").animate([{ opacity: 0 }, { opacity: 1 }], {
				duration: 300,
				iterations: Infinity,
				easing: "ease-in",
				fill: "both",
				delay: 10,
				direction: "alternate",
			}),
		);
		await background(() => animation.pause());
		await background(() => animation.play());
		expect(animation.id).toMatch(/^sohedra-animation-\d+$/);
		expect(animation.effect.target).toBe(node("box"));
		expect(page.engine.animations.map((call) => call.args)).toEqual([
			[
				0,
				animation.id,
				[{ opacity: 0 }, { opacity: 1 }],
				{
					duration: 300,
					delay: 10,
					direction: "alternate",
					iterations: "infinite",
					fill: "both",
					easing: "ease-in",
				},
			],
			[2, animation.id],
			[1, animation.id],
		]);
		expect(page.engine.state(page.byClass("box")).attrs["flatten"]).toBe(false);
	});

	it("takes a number as the duration, and a name of its own", async () => {
		const { page, node, background } = await methods();
		const [animation] = await background(() =>
			node("box").animate([{ opacity: 1 }], { name: "fade", duration: 1 }),
		);
		const [short] = await background(() => node("box").animate([{ opacity: 0 }], 200));
		expect(animation.id).toBe("fade");
		expect(page.engine.animations.map((call) => call.args[3])).toEqual([
			{ duration: 1 },
			{ duration: 200 },
		]);
		expect(short.effect.options).toEqual({ duration: 200 });
	});

	it("throws for an element that is not on the page", async () => {
		const { page, node, tap } = await methods();
		const doomed = node("doomed");
		await tap("doom");
		expect(() => page.asBackground(() => doomed.animate([{ opacity: 0 }], 100))).toThrow(
			/not on the page/,
		);
	});

	it("does nothing once the page is gone, and its finished rejects", async () => {
		const { page, node } = await methods();
		const box = node("box");
		page.destroy();
		await page.settle();
		const animation = page.asBackground(() => box.animate([{ opacity: 0 }], 100));
		animation.play();
		animation.finish();
		await expect(animation.finished).rejects.toMatchObject({ code: "page_is_gone" });
		expect(page.engine.animations).toEqual([]);
	});
});
