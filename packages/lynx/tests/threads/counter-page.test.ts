// A counter page through every layer: the compiled component and the renderer on the background,
// the patch, and the main thread's runtime on the engine fake.

import { describe, expect, it } from "@rstest/core";

import { readGlobal } from "../../src/testing/globals.ts";
import { PATCH_METHOD } from "../../src/wire/index.ts";
import Counter from "../fixtures/threads/Counter.svelte";
import Optional from "../fixtures/threads/Optional.svelte";
import { startSveltePage } from "./svelte-page.ts";

async function counter() {
	const page = startSveltePage(Counter, { initData: { from: "native" } });
	await page.settle();
	return page;
}

const tap = async (page: Awaited<ReturnType<typeof counter>>, token: string) => {
	page.engine.dispatch(page.byClass(token), { type: "tap" });
	await page.settle();
};

describe("a counter page", () => {
	it("listens to the engine and puts its patch function on the main thread's globals", async () => {
		const page = await counter();
		expect(page.engine.lifecycle.count("__RenderPage")).toBe(1);
		expect(page.engine.lifecycle.count("__UpdatePage")).toBe(1);
		page.asMainThread(() => {
			expect(typeof readGlobal(PATCH_METHOD)).toBe("function");
			expect((readGlobal("processData") as (data: unknown) => unknown)({ a: 1 })).toEqual({ a: 1 });
		});
	});

	it("takes the data the page was opened with, and installs the engine's hooks on the app", async () => {
		const page = await counter();
		expect(page.lynx.background.__initData).toEqual({ from: "native" });
		for (const hook of ["updateCardData", "onAppReload", "callDestroyLifetimeFun", "publishEvent"])
			expect(typeof page.app[hook], hook).toBe("function");
	});

	it("renders the first screen with one patch, raw text only under text", async () => {
		const page = await counter();
		expect(page.engine.texts()).toEqual(["Taps: 0 (even)", "Tap me"]);
		expect(page.patches).toHaveLength(1);
		expect(page.engine.state(page.byClass("root")).inlineStyles.get("padding")).toBe("24px");
		for (const element of page.engine.all())
			if (page.engine.state(element).tag === "raw-text")
				expect(page.engine.state(element.parentNode as never).tag).toBe("text");
		expect(page.errors).toEqual([]);
	});

	it("binds a tap as a bubbling listener", async () => {
		const page = await counter();
		expect(page.engine.state(page.byClass("button")).listeners).toEqual([
			expect.objectContaining({ name: "tap", options: { closure_type: 2, bind_type: 1 } }),
		]);
	});

	it("runs a tap on the background and flushes its update once", async () => {
		const page = await counter();
		const flushes = page.engine.flushes.length;
		page.engine.dispatch(page.byClass("button"), { type: "tap" });
		// Nothing changes on the main thread until the background answers.
		expect(page.engine.texts()[0]).toBe("Taps: 0 (even)");
		await page.settle();
		expect(page.engine.texts()[0]).toBe("Taps: 1 (odd)");
		expect(page.engine.flushes.length).toBe(flushes + 1);
	});

	it("mounts and unmounts {#if} content", async () => {
		const page = await counter();
		for (let i = 0; i < 3; i++) await tap(page, "button");
		expect(page.engine.texts()).toContain("Three or more");
		expect(page.patches).toHaveLength(4);
	});

	it("merges updateCardData into the data, and starts from none on type 1", async () => {
		const page = await counter();
		page.updateData({ theme: "dark" });
		await page.settle();
		expect(page.lynx.background.__initData).toEqual({ from: "native", theme: "dark" });
		page.updateData({ theme: "light" }, { type: 1 });
		await page.settle();
		expect(page.lynx.background.__initData).toEqual({ theme: "light" });
	});

	it("is torn down before the engine's destroy call returns, and sends nothing after", async () => {
		let cleaned = false;
		const page = startSveltePage(Optional, {
			props: () => ({ show: true, onclean: () => (cleaned = true) }),
		});
		await page.settle();
		const sent = page.patches.length;
		page.asBackground(() => (page.app["callDestroyLifetimeFun"] as () => void)());
		expect(cleaned).toBe(true);
		await page.settle();
		expect(page.patches.length).toBe(sent);
	});

	it("unmounts the app at the end of its life, and the main thread drops its listeners", async () => {
		const page = await counter();
		await tap(page, "button");
		page.destroy();
		await page.settle();
		expect(page.engine.listenerCount()).toBe(0);
		expect(page.engine.lifecycle.count("__RenderPage")).toBe(0);
		expect(page.engine.lifecycle.count("__UpdatePage")).toBe(0);
		expect(page.errors).toEqual([]);
	});
});
