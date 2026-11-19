// `keyboard`: the on-screen keyboard from Lynx's `keyboardstatuschanged`, whose arguments differ by
// platform: iOS sends ("on", height) and ("off", 0), Android ("on" | "off", height, height), again
// as the height changes. It listens from its first read, which also starts Android's detection, to
// the page's end.

import { describe, expect, it } from "@rstest/core";

import { keyboard } from "../../../src/background/host-entry.ts";
import KeyboardProbe from "../../fixtures/threads/host/KeyboardProbe.svelte";
import { startSveltePage } from "../svelte-page.ts";
import type { SveltePage } from "../svelte-page.ts";

async function shown(): Promise<SveltePage> {
	const page = startSveltePage(KeyboardProbe);
	await page.settle();
	page.engine.dispatch(page.byClass("show"), { type: "tap" });
	await page.settle();
	return page;
}

async function send(page: SveltePage, ...args: unknown[]): Promise<string> {
	page.emitHostEvent("keyboardstatuschanged", args);
	await page.settle();
	return page.engine.text(page.byClass("keyboard"));
}

describe("keyboard", () => {
	it("is closed before any event, and its first read listens, which starts the detection", async () => {
		const page = startSveltePage(KeyboardProbe);
		await page.settle();
		expect(page.hostEvents.asked).toBe(0);
		page.engine.dispatch(page.byClass("show"), { type: "tap" });
		await page.settle();
		expect(page.engine.text(page.byClass("keyboard"))).toBe("closed 0");
		expect(page.hostEvents.listeners("keyboardstatuschanged")).toBe(1);
		expect(page.hostEvents.keyboardDetection).toEqual([true]);
	});

	it("opens and closes from iOS's arguments", async () => {
		const page = await shown();
		expect(await send(page, "on", 347)).toBe("open 347");
		expect(await send(page, "off", 0)).toBe("closed 0");
		expect(page.errors).toEqual([]);
	});

	it("follows Android's arguments, and each height as the keyboard animates", async () => {
		const page = await shown();
		expect(await send(page, "on", 120, 120)).toBe("open 120");
		expect(await send(page, "on", 291, 291)).toBe("open 291");
		expect(await send(page, "off", 0, 0)).toBe("closed 0");
	});

	it("is closed with no height when Android measures a closed keyboard to a view above the window's bottom", async () => {
		const page = await shown();
		await send(page, "on", 291, 291);
		expect(await send(page, "off", 48, 48)).toBe("closed 0");
	});

	it("is open with no height when Android measures the keyboard below a view that ends above it", async () => {
		const page = await shown();
		expect(await send(page, "on", -69, -69)).toBe("open 0");
	});

	it("is open with no height when the event gives none", async () => {
		const page = await shown();
		expect(await send(page, "on")).toBe("open 0");
	});

	it("reads as closed when first read while the keyboard is open, until it changes", async () => {
		const page = startSveltePage(KeyboardProbe);
		await page.settle();
		// Nothing listens yet: the event is lost.
		page.emitHostEvent("keyboardstatuschanged", ["on", 300]);
		await page.settle();
		page.engine.dispatch(page.byClass("show"), { type: "tap" });
		await page.settle();
		expect(page.engine.text(page.byClass("keyboard"))).toBe("closed 0");
		expect(await send(page, "on", 310, 310)).toBe("open 310");
	});

	it("is the same value until the keyboard changes", async () => {
		const page = await shown();
		await send(page, "on", 300);
		const first = page.asBackground(() => keyboard.current);
		await send(page, "on", 300);
		expect(page.asBackground(() => keyboard.current)).toBe(first);
		expect(first).toEqual({ open: true, height: 300 });
	});

	it("stops listening when the page ends, and listens again on the next page", async () => {
		const first = await shown();
		await send(first, "on", 300);
		first.destroy();
		await first.settle();
		expect(first.hostEvents.listeners("keyboardstatuschanged")).toBe(0);
		const page = await shown();
		expect(page.engine.text(page.byClass("keyboard"))).toBe("closed 0");
		expect(page.hostEvents.listeners("keyboardstatuschanged")).toBe(1);
		expect(await send(page, "on", 280)).toBe("open 280");
	});
});
