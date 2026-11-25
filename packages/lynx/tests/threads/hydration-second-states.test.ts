// Early taps around the blocks whose state is not an `{#if}`'s branch: a list's `{:else}`, an
// `{#await}`, a boundary's `pending` and `failed`, a dynamic component that is nothing. Where both
// threads drew the same state, every tap runs its own handler. Where they drew another, only that
// block is made again: a tap in it is dropped, and its neighbors' run. Nothing refuses hydration.

import { describe, expect, it } from "@rstest/core";

import AwaitGiven from "../fixtures/threads/early/AwaitGiven.svelte";
import drawAwaitGiven from "../fixtures/threads/early/AwaitGiven.svelte?first-frame";
import AwaitThenInCell from "../fixtures/threads/early/AwaitThenInCell.svelte";
import drawAwaitThenInCell from "../fixtures/threads/early/AwaitThenInCell.svelte?first-frame";
import BoundaryFailed from "../fixtures/threads/early/BoundaryFailed.svelte";
import drawBoundaryFailed from "../fixtures/threads/early/BoundaryFailed.svelte?first-frame";
import BoundaryPending from "../fixtures/threads/early/BoundaryPending.svelte";
import drawBoundaryPending from "../fixtures/threads/early/BoundaryPending.svelte?first-frame";
import DynamicNothing from "../fixtures/threads/early/DynamicNothing.svelte";
import drawDynamicNothing from "../fixtures/threads/early/DynamicNothing.svelte?first-frame";
import EachElseBetween from "../fixtures/threads/early/EachElseBetween.svelte";
import drawEachElseBetween from "../fixtures/threads/early/EachElseBetween.svelte?first-frame";
import type { FirstFrameCopy } from "./svelte-page.ts";
import { startSveltePage } from "./svelte-page.ts";

/** Taps `taps` on the first frame drawn from `drawn`, and lets the background's `built` hydrate it. */
async function tapped(
	App: Parameters<typeof startSveltePage>[0],
	draw: FirstFrameCopy,
	{ drawn, built = drawn, taps }: { drawn: object; built?: object; taps: string[] },
) {
	const log: unknown[] = [];
	const page = startSveltePage(App, {
		props: () => ({ ...built, log }),
		firstFrame: { draw, props: { ...drawn, log } },
	});
	for (const token of taps) page.engine.dispatch(page.byClass(token), { type: "tap" });
	await page.settle();
	const rewrites = page.messages.filter((message) => message.t === "rewrite");
	return { page, log, rewrites };
}

const never = new Promise(() => {});

describe("an early tap around a list's {:else}", () => {
	it("runs its own handler where both threads drew it, or both drew the row", async () => {
		const empty = await tapped(EachElseBetween, drawEachElseBetween, {
			drawn: { items: [] },
			taps: ["row", "after"],
		});
		expect(empty.log).toEqual(["add the first", "after"]);
		const row = await tapped(EachElseBetween, drawEachElseBetween, {
			drawn: { items: ["x"] },
			taps: ["row"],
		});
		expect(row.log).toEqual(["open x"]);
	});

	it.each([
		["drew it, and the background a row", [], ["x"]],
		["drew a row, and the background it", ["x"], []],
	])("is dropped where the first frame %s, and its neighbors' run", async (_, drawn, built) => {
		const { page, log, rewrites } = await tapped(EachElseBetween, drawEachElseBetween, {
			drawn: { items: drawn },
			built: { items: built },
			taps: ["row", "before", "after"],
		});
		expect(log).toEqual(["before", "after"]);
		expect(page.errors).toEqual([]);
		expect(rewrites).toEqual([]);
	});
});

describe("an early tap around an {#await}", () => {
	it("runs its own handler where both threads were given a value", async () => {
		const { log } = await tapped(AwaitGiven, drawAwaitGiven, {
			drawn: { given: 7 },
			taps: ["item", "after"],
		});
		expect(log).toEqual(["open 7", "after"]);
	});

	it.each([
		["a promise on both threads", never, never, ["before", "Loading", "after"]],
		["a promise that has settled, on both threads", Promise.resolve(7), Promise.resolve(7), null],
		["a promise on the first frame, a value on the background", never, 7, ["before", "7", "after"]],
		[
			"a value on the first frame, a promise on the background",
			7,
			never,
			["before", "Loading", "after"],
		],
	])(
		"is dropped in the block, given %s, and its neighbors' run",
		async (_, drawn, built, texts) => {
			const { page, log, rewrites } = await tapped(AwaitGiven, drawAwaitGiven, {
				drawn: { given: drawn },
				built: { given: built },
				taps: ["item", "before", "after"],
			});
			expect(log).toEqual(["before", "after"]);
			if (texts) expect(page.engine.texts()).toEqual(texts);
			expect(page.errors).toEqual([]);
			expect(rewrites).toEqual([]);
		},
	);

	it("given a promise in a cell, lets its neighbors' run", async () => {
		const log: unknown[] = [];
		const page = startSveltePage(AwaitThenInCell, {
			props: () => ({ given: never, log }),
			firstFrame: { draw: drawAwaitThenInCell, props: { given: never, log } },
		});
		page.engine.list(page.byClass("list")).show(0);
		for (const token of ["before", "after"])
			page.engine.dispatch(page.byClass(token), { type: "tap" });
		await page.settle();
		expect(log).toEqual(["before", "after"]);
		expect(page.errors).toEqual([]);
	});
});

describe("an early tap around a boundary", () => {
	it("is dropped in the pending the first frame drew, and its neighbors' run", async () => {
		const { page, log, rewrites } = await tapped(BoundaryPending, drawBoundaryPending, {
			drawn: {},
			taps: ["item", "after"],
		});
		expect(log).toEqual(["after"]);
		expect(page.engine.texts()).toEqual(["child", "after"]);
		expect(page.errors).toEqual([]);
		expect(rewrites).toEqual([]);
	});

	it("whose children throw on the background only, makes it again in place, and its neighbors' run", async () => {
		const { page, log, rewrites } = await tapped(BoundaryFailed, drawBoundaryFailed, {
			drawn: { throws: false },
			built: { throws: true },
			taps: ["ok", "before", "after"],
		});
		expect(log).toEqual(["before", "after"]);
		expect(page.engine.texts()).toEqual(["before", "failed", "after"]);
		expect(page.errors.map((error) => (error as { code?: string }).code)).not.toContain(
			"hydration_mismatch",
		);
		expect(rewrites).toEqual([]);
	});
});

describe("an early tap beside a dynamic component that is nothing", () => {
	it("runs its own handler", async () => {
		const { log, page } = await tapped(DynamicNothing, drawDynamicNothing, {
			drawn: {},
			taps: ["after"],
		});
		expect(log).toEqual(["after"]);
		expect(page.errors).toEqual([]);
	});
});
