// `on(host, …)` in module-level code, which runs before the page's entry calls `mountPage`: the
// listener gets the host's events with their arguments, through the page's life, and its remover
// removes it. One page in the file: the runtime has run none before it.

import { describe, expect, it } from "@rstest/core";
import { on } from "svelte/events";

import { host } from "../../../src/background/host-entry.ts";
import { mountPage } from "../../../src/background/index.ts";
import { startMainThread } from "../../../src/main-thread/index.ts";
import { startTestPage } from "../../../src/testing/index.ts";
import Counter from "../../fixtures/threads/Counter.svelte";

describe("a host listener added before the page starts", () => {
	it("gets each event's arguments, nothing is reported, and its remover removes it", async () => {
		const log: unknown[] = [];
		const page = startTestPage({
			mainThread: () => startMainThread(),
			background: () => {
				on(host, "onWindowResize", (width, height) => void log.push([width, height]));
				on(host, "keyboardstatuschanged", (status, height) => void log.push([status, height]));
				on(host, "onFontScaleChanged", ({ scale }) => void log.push(scale));
				on(host, "cartchanged", () => void log.push("removed"))();
				mountPage(Counter);
			},
		});
		await page.settle();
		page.emitHostEvent("onWindowResize", [390, 844]);
		page.emitHostEvent("keyboardstatuschanged", ["on", 300]);
		page.emitHostEvent("onFontScaleChanged", [{ scale: 1.2 }]);
		page.emitHostEvent("cartchanged", [1]);
		await page.settle();
		expect(log).toEqual([[390, 844], ["on", 300], 1.2]);
		expect(page.hostEvents.listeners("cartchanged")).toBe(0);
		expect(page.errors).toEqual([]);
		page.reload();
		await page.settle();
		page.emitHostEvent("onWindowResize", [844, 390]);
		await page.settle();
		expect(log.at(-1)).toEqual([844, 390]);
		expect(page.errors).toEqual([]);
	});
});
