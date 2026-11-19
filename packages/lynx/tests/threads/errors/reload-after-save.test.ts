// In a development build, a hot update that lands after Svelte threw while it mounted, flushed or
// ran effects loads the page again, so the component that threw mounts again from its new code. An
// app's own `reportError`, a handler's throw and the binding's own reports leave the page as it is.

import { describe, expect, it } from "@rstest/core";

import EffectFails from "../../fixtures/threads/errors/EffectFails.svelte";
import Errors from "../../fixtures/threads/errors/Errors.svelte";
import drawErrors from "../../fixtures/threads/errors/Errors.svelte?first-frame";
import Parent from "../../fixtures/threads/errors/Parent.svelte";
import Fails from "../../fixtures/threads/Fails.svelte";
import Faults from "../../fixtures/threads/Faults.svelte";
import { startSveltePage } from "../svelte-page.ts";
import type { SveltePage } from "../svelte-page.ts";
import { devLoop } from "./dev-loop.ts";
import { lynxTimer, tapAndWait } from "./lynx-timer.ts";

/** The page of `Errors.svelte`, with its dev loop and an `onError`. */
async function errorsPage(onError?: () => void): Promise<{
	page: SveltePage;
	save(): number;
	tap(name: string): Promise<void>;
}> {
	// The first-frame copy registers the main-thread function; no frame is drawn.
	void drawErrors;
	const made: { page?: SveltePage } = {};
	const page = startSveltePage(Errors, {
		props: { later: lynxTimer(() => made.page!) },
		onError: onError ?? (() => {}),
	});
	made.page = page;
	await page.settle();
	return { page, save: devLoop(page).save, tap: (name) => tapAndWait(page, name) };
}

describe("a save after an error that is not Svelte's", () => {
	it("leaves the page after the app's own reportError", async () => {
		const { page, save, tap } = await errorsPage();
		await tap("report");
		expect(page.errors).toHaveLength(1);
		expect(save()).toBe(0);
	});

	it("leaves the page after a handler's throw", async () => {
		const { page, save, tap } = await errorsPage();
		await tap("handler");
		expect(page.errors).toHaveLength(1);
		expect(save()).toBe(0);
	});

	it("leaves the page after a main-thread function's throw", async () => {
		const { page, save, tap } = await errorsPage();
		await tap("main-thread");
		expect(page.errors).toHaveLength(1);
		expect(save()).toBe(0);
	});

	it("leaves the page after a background function a main-thread function called threw", async () => {
		const { page, save, tap } = await errorsPage();
		await tap("call");
		expect(page.errors).toHaveLength(1);
		expect(save()).toBe(0);
	});

	it("leaves the page after what onError threw", async () => {
		const { page, save, tap } = await errorsPage(() => {
			throw new Error("onError threw");
		});
		await tap("report");
		expect(page.errors).toHaveLength(2);
		expect(save()).toBe(0);
	});

	it("leaves the page after the binding's own reports", async () => {
		const page = startSveltePage(Faults);
		await page.settle();
		const { save } = devLoop(page);
		expect(page.errors.length).toBeGreaterThan(0);
		expect(save()).toBe(0);
	});
});

describe("a save after Svelte threw", () => {
	it("loads the page again after a component threw as the page started", async () => {
		const page = startSveltePage(Fails);
		await page.settle();
		const { save } = devLoop(page);
		expect(save()).toBe(1);
	});

	it("loads the page again after an effect threw as the page started", async () => {
		const page = startSveltePage(EffectFails);
		await page.settle();
		const { save } = devLoop(page);
		expect(page.errors).toHaveLength(1);
		expect(save()).toBe(1);
	});

	it("loads the page again after a component threw as the page reloaded", async () => {
		const page = startSveltePage(Fails);
		await page.settle();
		const { save } = devLoop(page);
		page.reload();
		await page.settle();
		expect(page.errors).toHaveLength(2);
		expect(save()).toBe(1);
	});

	it("loads the page again after an effect a timer's change ran threw", async () => {
		const { page, save, tap } = await errorsPage();
		await tap("effect");
		expect(page.errors).toHaveLength(1);
		expect(save()).toBe(1);
	});

	it("loads the page again after an effect a handler's change ran threw", async () => {
		const page = startSveltePage(Parent);
		await page.settle();
		const { save } = devLoop(page);
		page.engine.dispatch(page.byClass("more"), { type: "tap" });
		await page.settle();
		expect(page.errors).toHaveLength(1);
		expect(save()).toBe(1);
	});

	it("loads the page again once, then leaves the page it loaded", async () => {
		const { page, save, tap } = await errorsPage();
		await tap("effect");
		expect(save()).toBe(1);
		page.reload();
		await page.settle();
		expect(save()).toBe(1);
	});
});
