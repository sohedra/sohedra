// Pages that await, in Svelte's async mode: the `page-async` project compiles every page test with
// `experimental.async` on, and only it runs these. Each page draws its first frame, the background
// hydrates it, and a tap updates it.

import { afterEach, describe, expect, it, rs } from "@rstest/core";

import type { LynxElement } from "../../../src/testing/index.ts";
import AwaitBlock from "../../fixtures/threads/async/AwaitBlock.svelte";
import drawAwaitBlock from "../../fixtures/threads/async/AwaitBlock.svelte?first-frame";
import Counted from "../../fixtures/threads/async/Counted.svelte";
import drawCounted from "../../fixtures/threads/async/Counted.svelte?first-frame";
import CountedInBoundary from "../../fixtures/threads/async/CountedInBoundary.svelte";
import drawCountedInBoundary from "../../fixtures/threads/async/CountedInBoundary.svelte?first-frame";
import CssPropAfterAwait from "../../fixtures/threads/async/CssPropAfterAwait.svelte";
import drawCssPropAfterAwait from "../../fixtures/threads/async/CssPropAfterAwait.svelte?first-frame";
import CssPropAfterAwaitInBoundary from "../../fixtures/threads/async/CssPropAfterAwaitInBoundary.svelte";
import drawCssPropAfterAwaitInBoundary from "../../fixtures/threads/async/CssPropAfterAwaitInBoundary.svelte?first-frame";
import DoubledInBoundary from "../../fixtures/threads/async/DoubledInBoundary.svelte";
import drawDoubledInBoundary from "../../fixtures/threads/async/DoubledInBoundary.svelte?first-frame";
import DoubledModuleInBoundary from "../../fixtures/threads/async/DoubledModuleInBoundary.svelte";
import drawDoubledModuleInBoundary from "../../fixtures/threads/async/DoubledModuleInBoundary.svelte?first-frame";
import Rejected from "../../fixtures/threads/async/Rejected.svelte";
import drawRejected from "../../fixtures/threads/async/Rejected.svelte?first-frame";
import TimedPending from "../../fixtures/threads/async/TimedPending.svelte";
import drawTimedPending from "../../fixtures/threads/async/TimedPending.svelte?first-frame";
import { startSveltePage } from "../svelte-page.ts";
import type { SveltePage } from "../svelte-page.ts";

afterEach(() => {
	rs.useRealTimers();
});

/** Starts the page with its first frame, and keeps the elements the first frame drew. */
function start(App: unknown, draw: unknown): { page: SveltePage; drawn: LynxElement[] } {
	// Boundary: each fixture is a component and its first-frame copy.
	const page = startSveltePage(App as never, { firstFrame: { draw: draw as never } });
	return { page, drawn: page.engine.all() };
}

/** How many of the elements the first frame drew are still on the page. */
const kept = (page: SveltePage, drawn: LynxElement[]): number =>
	drawn.filter((element) => page.engine.all().includes(element)).length;

/** The code of each warning the page reported. */
const warningCodes = (page: SveltePage): unknown[] =>
	page.warnings.map((warning) => (warning as { code?: unknown }).code);

/** The value of the custom property `--size` on the page, as each element has it inline. */
const sizes = (page: SveltePage): unknown[] =>
	page.engine
		.all()
		.map((element) => page.engine.state(element).inlineStyles.get("--size"))
		.filter((size) => size !== undefined);

describe("a page that awaits at the top of its root component", () => {
	it("has no first frame and says why; the background draws it, and a tap updates it", async () => {
		const { page } = start(Counted, drawCounted);
		expect(page.engine.texts()).toEqual([]);
		expect(warningCodes(page)).toEqual(["first_frame_skipped_await"]);
		await page.settle();
		expect(page.engine.texts()).toEqual(["Count: 1", "add"]);
		page.engine.dispatch(page.byClass("add"), { type: "tap" });
		await page.settle();
		expect(page.engine.texts()).toEqual(["Count: 2", "add"]);
		expect(page.errors).toEqual([]);
	});

	it("sets a custom property declared after the await (sveltejs/svelte#19355)", async () => {
		const { page } = start(CssPropAfterAwait, drawCssPropAfterAwait);
		expect(warningCodes(page)).toEqual(["first_frame_skipped_await"]);
		await page.settle();
		expect(sizes(page)).toEqual(["1px"]);
		page.engine.dispatch(page.byClass("grow"), { type: "tap" });
		await page.settle();
		expect(sizes(page)).toEqual(["2px"]);
		expect(page.errors).toEqual([]);
	});
});

describe("a page that awaits in a boundary with a pending snippet", () => {
	it("draws the pending snippet first, and hydrates the rest around the awaited content", async () => {
		const { page, drawn } = start(CountedInBoundary, drawCountedInBoundary);
		expect(page.engine.texts()).toEqual(["Title", "Loading"]);
		await page.settle();
		expect(page.engine.texts()).toEqual(["Title", "Count: 1", "add"]);
		// The page, its view and the title (with its text) stay; the pending snippet goes.
		expect([kept(page, drawn), drawn.length]).toEqual([4, 6]);
		page.engine.dispatch(page.byClass("add"), { type: "tap" });
		await page.settle();
		expect(page.engine.texts()).toEqual(["Title", "Count: 2", "add"]);
		expect(page.errors).toEqual([]);
		expect(page.warnings).toEqual([]);
	});

	it("shows a $derived of an await once it settles, and again after a change", async () => {
		const { page } = start(DoubledInBoundary, drawDoubledInBoundary);
		expect(page.engine.texts()).toEqual(["Loading"]);
		await page.settle();
		expect(page.engine.texts()).toEqual(["Doubled: 2", "add"]);
		page.engine.dispatch(page.byClass("add"), { type: "tap" });
		await page.settle();
		expect(page.engine.texts()).toEqual(["Doubled: 4", "add"]);
		expect(page.errors).toEqual([]);
		expect(page.warnings).toEqual([]);
	});

	it("shows a $derived of an await in a rune module, and again after a change", async () => {
		const { page } = start(DoubledModuleInBoundary, drawDoubledModuleInBoundary);
		expect(page.engine.texts()).toEqual(["Loading"]);
		await page.settle();
		expect(page.engine.texts()).toEqual(["Doubled: 2", "add"]);
		page.engine.dispatch(page.byClass("add"), { type: "tap" });
		await page.settle();
		expect(page.engine.texts()).toEqual(["Doubled: 4", "add"]);
		expect(page.errors).toEqual([]);
		expect(page.warnings).toEqual([]);
	});

	it("shows the failed snippet for an await that rejects", async () => {
		const { page } = start(Rejected, drawRejected);
		expect(page.engine.texts()).toEqual(["Loading"]);
		await page.settle();
		expect(page.engine.texts()).toEqual(["Failed: not found"]);
		expect(page.errors).toEqual([]);
		expect(page.warnings).toEqual([]);
	});

	it("waits for a background timer, and counts what an update waits for with $effect.pending()", async () => {
		rs.useFakeTimers();
		const { page } = start(TimedPending, drawTimedPending);
		await page.settle();
		expect(page.engine.texts()).toEqual(["Loading"]);
		rs.advanceTimersByTime(100);
		await page.settle();
		expect(page.engine.texts()).toEqual(["Doubled: 2", "Waiting for 0", "add"]);
		page.engine.dispatch(page.byClass("add"), { type: "tap" });
		await page.settle();
		expect(page.engine.texts()).toEqual(["Doubled: 2", "Waiting for 1", "add"]);
		// The timer settles the await after the main thread ran.
		page.asMainThread(() => undefined);
		rs.advanceTimersByTime(100);
		await page.settle();
		expect(page.engine.texts()).toEqual(["Doubled: 4", "Waiting for 0", "add"]);
		expect(page.errors).toEqual([]);
		expect(page.warnings).toEqual([]);
	});

	it("sets a custom property declared after the await (sveltejs/svelte#19355)", async () => {
		const { page } = start(CssPropAfterAwaitInBoundary, drawCssPropAfterAwaitInBoundary);
		expect(page.engine.texts()).toEqual(["Loading"]);
		await page.settle();
		expect(sizes(page)).toEqual(["1px"]);
		page.engine.dispatch(page.byClass("grow"), { type: "tap" });
		await page.settle();
		expect(sizes(page)).toEqual(["2px"]);
		expect(page.errors).toEqual([]);
		expect(page.warnings).toEqual([]);
	});
});

describe("an {#await} with a pending branch, in async mode", () => {
	it("hydrates the first frame's pending branch, and shows each promise's value", async () => {
		const { page } = start(AwaitBlock, drawAwaitBlock);
		expect(page.engine.texts()).toEqual(["Loading", "next"]);
		await page.settle();
		expect(page.messages.filter((message) => message.t === "rewrite")).toEqual([]);
		expect(page.engine.texts()).toEqual(["round 1", "next"]);
		page.engine.dispatch(page.byClass("next"), { type: "tap" });
		await page.settle();
		expect(page.engine.texts()).toEqual(["round 2", "next"]);
		expect(page.errors).toEqual([]);
		expect(page.warnings).toEqual([]);
	});
});
