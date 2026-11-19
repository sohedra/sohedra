// `on(host, …)`: the host's events, which reach the background through lynx-core's
// `GlobalEventEmitter`. The emitter has one listener of the page's per event name while anything
// listens to it, none after the last goes and none once the page has ended, and a page that never
// listens never asks lynx-core for it. A listener that throws is reported, and the others run.

import { describe, expect, it } from "@rstest/core";
import { on } from "svelte/events";

import { host } from "../../../src/background/host-entry.ts";
import Counter from "../../fixtures/threads/Counter.svelte";
import HostListener from "../../fixtures/threads/host/HostListener.svelte";
import { startSveltePage } from "../svelte-page.ts";

function listening(name = "onWindowResize") {
	const log: unknown[][] = [];
	const page = startSveltePage(HostListener, { props: () => ({ name, log }) });
	return { page, log };
}

describe("the host's events", () => {
	it("asks lynx-core for nothing while the page never listens", async () => {
		const page = startSveltePage(Counter);
		await page.settle();
		page.emitHostEvent("onWindowResize", [390, 844]);
		page.destroy();
		await page.settle();
		expect(page.hostEvents.asked).toBe(0);
		expect(page.errors).toEqual([]);
	});

	it("passes an event's arguments to a listener of an effect", async () => {
		const { page, log } = listening();
		await page.settle();
		page.emitHostEvent("onWindowResize", [390, 844]);
		page.emitHostEvent("onFontScaleChanged", [{ scale: 1.2 }]);
		await page.settle();
		expect(log).toEqual([[390, 844]]);
		expect(page.hostEvents.listeners("onWindowResize")).toBe(1);
	});

	it("gives the emitter one listener of a name however many listen, and removes it with the last", async () => {
		const page = startSveltePage(Counter);
		await page.settle();
		const heard: string[] = [];
		const offOne = page.asBackground(() =>
			on(host, "keyboardstatuschanged", () => heard.push("one")),
		);
		const offTwo = page.asBackground(() =>
			on(host, "keyboardstatuschanged", () => heard.push("two")),
		);
		expect(page.hostEvents.asked).toBe(1);
		expect(page.hostEvents.listeners("keyboardstatuschanged")).toBe(1);
		page.emitHostEvent("keyboardstatuschanged", ["on", 300]);
		await page.settle();
		expect(heard).toEqual(["one", "two"]);
		// The emitter keeps the page's one listener while one of the page's is left: lynx-core
		// hears of no removal until the last.
		offOne();
		expect(page.hostEvents.keyboardDetection).toEqual([true]);
		offTwo();
		expect(page.hostEvents.keyboardDetection).toEqual([true, false]);
		expect(page.hostEvents.listeners("keyboardstatuschanged")).toBe(0);
		offTwo();
		expect(page.hostEvents.keyboardDetection).toEqual([true, false]);
	});

	it("calls a function that listens twice through on() twice, and stops one at a time", async () => {
		const page = startSveltePage(Counter);
		await page.settle();
		let calls = 0;
		const hear = () => void calls++;
		const offFirst = page.asBackground(() => on(host, "cartchanged", hear));
		page.asBackground(() => on(host, "cartchanged", hear));
		page.emitHostEvent("cartchanged", [1]);
		await page.settle();
		expect(calls).toBe(2);
		offFirst();
		page.emitHostEvent("cartchanged", [2]);
		await page.settle();
		expect(calls).toBe(3);
	});

	it("keeps one listener that is added to the host twice", async () => {
		const page = startSveltePage(Counter);
		await page.settle();
		let calls = 0;
		const hear = () => void calls++;
		page.asBackground(() => {
			host.addEventListener("cartchanged", hear);
			host.addEventListener("cartchanged", hear);
		});
		page.emitHostEvent("cartchanged", []);
		await page.settle();
		expect(calls).toBe(1);
		host.removeEventListener("cartchanged", hear);
		expect(page.hostEvents.listeners("cartchanged")).toBe(0);
	});

	it("reports a listener that throws once, and still runs the others", async () => {
		const page = startSveltePage(Counter);
		await page.settle();
		const failure = new Error("the resize failed");
		const heard: string[] = [];
		page.asBackground(() => {
			on(host, "onWindowResize", () => {
				throw failure;
			});
			on(host, "onWindowResize", () => heard.push("after"));
		});
		page.emitHostEvent("onWindowResize", [390, 844]);
		await page.settle();
		expect(heard).toEqual(["after"]);
		expect(page.errors).toEqual([failure]);
	});

	it("runs every listener of an event though one removes itself as it runs", async () => {
		const page = startSveltePage(Counter);
		await page.settle();
		const heard: string[] = [];
		page.asBackground(() => {
			const off = on(host, "cartchanged", () => {
				heard.push("once");
				off();
			});
			on(host, "cartchanged", () => heard.push("always"));
		});
		page.emitHostEvent("cartchanged", []);
		page.emitHostEvent("cartchanged", []);
		await page.settle();
		expect(heard).toEqual(["once", "always", "always"]);
	});

	it("stops a listener of an effect when the effect runs again, and listens to the new name", async () => {
		const log: unknown[][] = [];
		const page = startSveltePage(HostListener, {
			props: () => ({ name: "first", next: "second", log }),
		});
		await page.settle();
		page.engine.dispatch(page.byClass("switch"), { type: "tap" });
		await page.settle();
		page.emitHostEvent("first", [1]);
		page.emitHostEvent("second", [2]);
		await page.settle();
		expect(log).toEqual([[2]]);
		expect(page.hostEvents.listeners("first")).toBe(0);
		expect(page.hostEvents.listeners("second")).toBe(1);
	});
});

describe("the page's end", () => {
	it("removes every listener left on the emitter, also those of no effect", async () => {
		const { page } = listening("onWindowResize");
		await page.settle();
		page.asBackground(() => {
			host.addEventListener("cartchanged", () => {});
			host.addEventListener("keyboardstatuschanged", () => {});
		});
		page.destroy();
		await page.settle();
		for (const name of ["onWindowResize", "cartchanged", "keyboardstatuschanged"])
			expect(page.hostEvents.listeners(name), name).toBe(0);
		expect(page.errors).toEqual([]);
	});

	it("listens to nothing after the page has ended, and a remover does nothing", async () => {
		const page = startSveltePage(Counter);
		await page.settle();
		const off = page.asBackground(() => on(host, "cartchanged", () => {}));
		page.destroy();
		await page.settle();
		const asked = page.hostEvents.asked;
		page.asBackground(() => on(host, "cartchanged", () => {}))();
		off();
		expect(page.hostEvents.asked).toBe(asked);
		expect(page.hostEvents.listeners("cartchanged")).toBe(0);
	});

	it("leaves the same listeners on the emitter after each reload", async () => {
		const { page, log } = listening("onWindowResize");
		await page.settle();
		page.reload();
		await page.settle();
		page.reload();
		await page.settle();
		expect(page.hostEvents.listeners("onWindowResize")).toBe(1);
		page.emitHostEvent("onWindowResize", [390, 844]);
		await page.settle();
		expect(log).toEqual([[390, 844]]);
	});

	it("hears the host's events again on the next page of the runtime", async () => {
		const first = startSveltePage(Counter);
		await first.settle();
		first.destroy();
		await first.settle();
		const { page, log } = listening("onWindowResize");
		await page.settle();
		page.emitHostEvent("onWindowResize", [390, 844]);
		await page.settle();
		expect(log).toEqual([[390, 844]]);
	});
});
