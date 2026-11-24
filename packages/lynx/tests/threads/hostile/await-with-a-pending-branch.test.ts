// An `{#await}` block with a pending branch, under a first frame. The first frame draws the pending
// branch at once, as Svelte's server does; Svelte's client draws it only in a task it queues as it
// mounts, so the background's rendered items have nothing there, and the branch comes in the same
// first patch, after them. Hydration adopts the rest of the page, and makes the block's content
// from what follows.

import { describe, expect, it } from "@rstest/core";

import AwaitPending from "../../fixtures/threads/AwaitPending.svelte";
import drawAwaitPending from "../../fixtures/threads/AwaitPending.svelte?first-frame";
import { startSveltePage } from "../svelte-page.ts";

function awaiting(settles: boolean) {
	const props = { settles };
	return startSveltePage(AwaitPending, {
		props: () => props,
		firstFrame: { draw: drawAwaitPending, props },
	});
}

describe("an {#await} with a pending branch", () => {
	it("hydrates the first frame around it, whose promise never settles", async () => {
		const page = awaiting(false);
		expect(page.engine.texts()).toEqual(["Title", "Loading", "next"]);
		const title = page.byClass("title");
		const next = page.byClass("next");
		await page.settle();
		expect(page.messages.filter((message) => message.t === "rewrite")).toEqual([]);
		expect(page.errors).toEqual([]);
		expect(page.byClass("title")).toBe(title);
		expect(page.byClass("next")).toBe(next);
		expect(page.engine.texts()).toEqual(["Title", "Loading", "next"]);
	});

	it("hydrates the first frame around it, whose promise settled, and shows its value", async () => {
		const page = awaiting(true);
		const next = page.byClass("next");
		await page.settle();
		expect(page.messages.filter((message) => message.t === "rewrite")).toEqual([]);
		expect(page.errors).toEqual([]);
		expect(page.byClass("next")).toBe(next);
		expect(page.engine.texts()).toEqual(["Title", "round 1", "next"]);
		page.engine.dispatch(next, { type: "tap" });
		await page.settle();
		expect(page.engine.texts()).toEqual(["Title", "round 2", "next"]);
	});

	it("replays a tap the first frame heard outside it", async () => {
		const page = awaiting(false);
		page.engine.dispatch(page.byClass("next"), { type: "tap" });
		await page.settle();
		expect(page.errors).toEqual([]);
		expect(page.engine.texts()).toEqual(["Title", "round 2", "next"]);
	});
});
