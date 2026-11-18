// Main-thread functions in list rows. A row's function refs run as Lynx makes the row, inside its
// request and before the row's flush, so a row that scrolls back is never shown without what they
// set. A row the main thread lets go of lets go of its bindings with it: its refs hold nothing, its
// function refs' cleanups run, and everything binds again when the row is made again. A deferred
// row binds when its contents come, and a row of the first screen from the first frame on.

import { describe, expect, it } from "@rstest/core";

import FunctionRows from "../../fixtures/threads/functions/FunctionRows.svelte";
import drawFunctionRows from "../../fixtures/threads/functions/FunctionRows.svelte?first-frame";
import ThrowRows from "../../fixtures/threads/functions/ThrowRows.svelte";
import drawThrowRows from "../../fixtures/threads/functions/ThrowRows.svelte?first-frame";
import { scroller, scrollThrough } from "../scroll.ts";
import { expectAccounted } from "./accounting.ts";
import { startFunctionsPage } from "./pages.ts";

interface Counts {
	runs: number;
	cleanups: number;
	first: unknown;
}

async function rows(
	options: {
		async?: boolean;
		defer?: boolean | { unmountRecycled?: boolean };
		initial?: number;
		firstFrame?: boolean;
	} = {},
) {
	const { firstFrame = false, ...props } = options;
	const log: unknown[][] = [];
	const api: Record<string, unknown> = {};
	const page = startFunctionsPage(FunctionRows, {
		draw: drawFunctionRows,
		props: { log, api, ...props },
		firstFrame,
	});
	await page.settle();
	const scroll = scroller(page.engine, page.byClass("list"));
	scroll.to(0);
	await page.settle();
	const read = async (): Promise<Counts> => {
		const answer = page.asBackground(() => (api["read"] as () => Promise<Counts>)());
		await page.settle();
		return answer;
	};
	const through = (from: number, to: number) =>
		scrollThrough({ scroll, from, to, settle: page.settle });
	/** How many rows have their elements on the page: each holds its function ref's run. */
	const made = () =>
		page.engine
			.all()
			.filter((element) => page.engine.state(element).attrs["attached"] !== undefined).length;
	return { page, log, api, scroll, read, through, made };
}

describe("a row's function ref", () => {
	it("runs inside Lynx's request for the row, before the row's flush", async () => {
		const { page } = await rows();
		const list = page.engine.list(page.byClass("list"));
		const flushes = page.engine.flushes.length;
		const cell = list.show(12);
		const row = page.engine
			.all(cell)
			.find((element) => page.engine.state(element).attrs["attached"]);
		expect(page.engine.state(row!).attrs["attached"]).toBe(13);
		// One flush, the row's, with what the ref set: the ref did not flush on its own.
		expect(page.engine.flushes.length).toBe(flushes + 1);
		expect(page.errors).toEqual([]);
	});

	it("is cleaned up when the main thread lets go of its row, and runs again when it comes back", async () => {
		const { page, read, through, made } = await rows();
		expect(await read()).toEqual({ runs: 9, cleanups: 0, first: 1 });
		await through(0, 31);
		const away = await read();
		// The rows let go of: a screen of them past those Lynx shows stays.
		expect(away.cleanups).toBeGreaterThan(10);
		expect(away.first).toBeNull();
		expect(away.runs - away.cleanups).toBe(made());
		await through(31, 0);
		const back = await read();
		expect(back.first).toBe(1);
		expect(back.runs - back.cleanups).toBe(made());
		expect(page.errors).toEqual([]);
	});

	it("lets a row's handler run again once its row is made again", async () => {
		const { page, log, through } = await rows();
		await through(0, 31);
		await through(31, 0);
		page.engine.dispatch(page.byClass("row-1"), { type: "tap" });
		await page.settle();
		expect(log).toEqual([["tap", 1]]);
	});
});

describe("a deferred row's function ref", () => {
	it("runs once its contents come", async () => {
		const { page, read } = await rows({ async: true, defer: true });
		expect((await read()).runs).toBe(9);
		expect(page.errors).toEqual([]);
	});

	it("is cleaned up when the main thread lets go of its row, and runs again when it comes back", async () => {
		const { page, read, through, made } = await rows({ async: true, defer: true });
		await through(0, 31);
		const away = await read();
		expect(away.cleanups).toBeGreaterThan(10);
		expect(away.runs - away.cleanups).toBe(made());
		await through(31, 0);
		const back = await read();
		expect(back.first).toBe(1);
		expect(back.runs - back.cleanups).toBe(made());
		expect(page.errors).toEqual([]);
	});

	it("is cleaned up with its contents, with unmountRecycled, and runs again when shown", async () => {
		const { page, read, through, made } = await rows({
			async: true,
			defer: { unmountRecycled: true },
		});
		await through(0, 31);
		const away = await read();
		expect(away.cleanups).toBeGreaterThan(10);
		expect(away.runs - away.cleanups).toBe(made());
		await through(31, 0);
		const back = await read();
		expect(back.first).toBe(1);
		expect(back.runs - back.cleanups).toBe(made());
		// The texts let go of with the rows' contents let their contexts go too.
		expectAccounted(page, "after rows unmounted and shown again");
		expect(page.errors).toEqual([]);
	});

	it("runs in the first frame for a row of the first screen, and not again at hydration", async () => {
		const { page, read } = await rows({ async: true, defer: true, initial: 9, firstFrame: true });
		expect(await read()).toEqual({ runs: 9, cleanups: 0, first: 1 });
		expect(page.errors).toEqual([]);
	});
});

describe("a function ref that throws", () => {
	async function throwing() {
		const api: Record<string, () => void> = {};
		const page = startFunctionsPage(ThrowRows, { draw: drawThrowRows, props: { api } });
		await page.settle();
		return { page, api };
	}

	it("leaves its row drawn and given to Lynx, and the rows after it bind and measure", async () => {
		const { page } = await throwing();
		const list = page.engine.list(page.byClass("list"));
		const rows = [0, 1, 2].map((index) => page.engine.text(list.show(index)));
		await page.settle();
		expect(rows).toEqual(["row 1", "row 2", "row 3"]);
		expect(page.engine.state(page.byClass("row-3")).attrs["attached"]).toBe("yes");
		expect(
			[1, 2, 3].map((id) => page.engine.state(page.byClass(`measured-${id}`)).attrs["measured"]),
		).toEqual(["yes", "yes", "yes"]);
		expect(page.errors).toEqual([expect.objectContaining({ message: "The row's ref threw." })]);
	});

	it("leaves the refs after it in its patch to run, and the patch flushed", async () => {
		const { page, api } = await throwing();
		const flushes = page.engine.flushes.length;
		page.asBackground(() => api["late"]!());
		await page.settle();
		expect(page.engine.state(page.byClass("second")).attrs["second"]).toBe("ran");
		expect(page.engine.flushes.length).toBeGreaterThan(flushes);
		expect(page.engine.texts()).toContain("after");
		expect(page.errors).toEqual([expect.objectContaining({ message: "The first ref threw." })]);
	});
});
