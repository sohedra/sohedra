// The one bridge between a test page's two threads: what one thread sends the other arrives on a
// later macrotask, as from another thread on a device, and `settle()` waits until nothing is on
// its way.

import { afterEach, describe, expect, it, rs } from "@rstest/core";

import { installGlobals, readGlobal } from "../../../../src/testing/globals.ts";
import { startTestPage } from "../../../../src/testing/index.ts";
import type { TestLynx } from "../../../../src/testing/index.ts";

/** The page's `lynx`, as each thread's code reads it: a global. */
const lynx = () => readGlobal("lynx") as TestLynx;

afterEach(() => {
	rs.useRealTimers();
});

describe("a message between the threads", () => {
	it("goes from the main thread to the background on a later task, never during the call", async () => {
		const page = startTestPage();
		const heard: unknown[] = [];
		lynx()
			.getCoreContext()
			.addEventListener("ping", (event) => heard.push(event));
		lynx()
			.getJSContext()
			.dispatchEvent({ type: "ping", data: { n: 1 } });
		expect(heard).toEqual([]);
		await page.settle();
		expect(heard).toEqual([{ type: "ping", data: { n: 1 }, origin: "CoreContext" }]);
	});

	it("goes from the background to the main thread the same way", async () => {
		const page = startTestPage();
		const heard: unknown[] = [];
		lynx()
			.getJSContext()
			.addEventListener("pong", (event) => heard.push(event));
		lynx().getCoreContext().dispatchEvent({ type: "pong", data: "x" });
		expect(heard).toEqual([]);
		await page.settle();
		expect(heard).toEqual([{ type: "pong", data: "x", origin: "JSContext" }]);
	});

	it("reaches only the other thread's listeners of its type, and not one that was removed", async () => {
		const page = startTestPage();
		const heard: string[] = [];
		const removed = () => heard.push("removed");
		const core = lynx().getCoreContext();
		core.addEventListener("ping", () => heard.push("background"));
		core.addEventListener("ping", removed);
		core.removeEventListener("ping", removed);
		core.addEventListener("other", () => heard.push("other"));
		lynx()
			.getJSContext()
			.addEventListener("ping", () => heard.push("main thread"));
		lynx().getJSContext().dispatchEvent({ type: "ping", data: null });
		await page.settle();
		expect(heard).toEqual(["background"]);
	});

	it("arrives even while the test fakes timers", async () => {
		const page = startTestPage();
		rs.useFakeTimers();
		const heard: unknown[] = [];
		lynx()
			.getCoreContext()
			.addEventListener("ping", (event) => heard.push(event.data));
		lynx().getJSContext().dispatchEvent({ type: "ping", data: 1 });
		await page.settle();
		expect(heard).toEqual([1]);
	});

	it("is dropped once the page has ended", async () => {
		const page = startTestPage();
		const heard: unknown[] = [];
		lynx()
			.getCoreContext()
			.addEventListener("ping", (event) => heard.push(event.data));
		lynx().getJSContext().dispatchEvent({ type: "ping", data: 1 });
		page.dispose();
		await new Promise((resolve) => setImmediate(resolve));
		expect(heard).toEqual([]);
	});
});

describe("settle", () => {
	it("waits for what a delivery sends in turn", async () => {
		const page = startTestPage();
		const heard: string[] = [];
		lynx()
			.getCoreContext()
			.addEventListener("ping", () => {
				heard.push("ping");
				lynx().getCoreContext().dispatchEvent({ type: "pong", data: null });
			});
		lynx()
			.getJSContext()
			.addEventListener("pong", () => heard.push("pong"));
		lynx().getJSContext().dispatchEvent({ type: "ping", data: null });
		await page.settle();
		expect(heard).toEqual(["ping", "pong"]);
	});

	it("waits for the answer of a UI method", async () => {
		const page = startTestPage();
		const f = page.engine.functions;
		const view = f.__CreateView(0);
		const answers: unknown[] = [];
		f.__InvokeUIMethod(view, "boundingClientRect", {}, (result) => answers.push(result));
		await page.settle();
		expect(answers).toEqual([{ code: 6 }]);
	});

	it("throws when the threads never stop sending", async () => {
		const page = startTestPage();
		const core = lynx().getCoreContext();
		core.addEventListener("ping", () =>
			lynx().getJSContext().dispatchEvent({ type: "ping", data: 0 }),
		);
		lynx()
			.getJSContext()
			.addEventListener("ping", () => core.dispatchEvent({ type: "ping", data: 0 }));
		lynx().getJSContext().dispatchEvent({ type: "ping", data: 0 });
		await expect(page.settle()).rejects.toThrow("still sending after 100 rounds");
		page.dispose();
	});
});

describe("callLepusMethod", () => {
	it("calls the main thread's global function on a later task, and calls back on a task after", async () => {
		const page = startTestPage();
		const order: string[] = [];
		const restore = installGlobals({
			patch: (params: unknown) => order.push(`patch ${JSON.stringify(params)}`),
		});
		lynx()
			.getNativeApp()
			.callLepusMethod("patch", { data: "1" }, () => order.push("callback"));
		order.push("sent");
		await new Promise((resolve) => setImmediate(resolve));
		order.push("one task later");
		await page.settle();
		expect(order).toEqual(["sent", 'patch {"data":"1"}', "one task later", "callback"]);
		restore();
	});

	it("reports a method the main thread does not have, as Lynx does", async () => {
		const page = startTestPage();
		lynx().getNativeApp().callLepusMethod("missing", {});
		await page.settle();
		expect(page.errors).toEqual([
			expect.objectContaining({ message: expect.stringContaining("callLepusMethod") }),
		]);
	});
});
