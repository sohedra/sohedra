// The one bridge between a test page's two threads: what one thread sends the other arrives on a
// later macrotask, as a copy, as from another thread on a device, and `settle()` waits until
// nothing is on its way.

import vm from "node:vm";

import { afterEach, describe, expect, it, rs } from "@rstest/core";

import { installGlobals, readGlobal } from "../../../../src/testing/globals.ts";
import { startTestPage } from "../../../../src/testing/index.ts";
import type { TestPage } from "../../../../src/testing/index.ts";

afterEach(() => {
	rs.useRealTimers();
});

/** Each thread's way to the other. */
const contexts = (page: TestPage) => ({
	main: page.lynx.mainThread.getJSContext(),
	background: page.lynx.background.getCoreContext(),
});

describe("a message between the threads", () => {
	it("goes from the main thread to the background on a later task, never during the call", async () => {
		const page = startTestPage();
		const { main, background } = contexts(page);
		const heard: unknown[] = [];
		background.addEventListener("ping", (event) => heard.push(event));
		main.dispatchEvent({ type: "ping", data: { n: 1 } });
		expect(heard).toEqual([]);
		await page.settle();
		expect(heard).toEqual([{ type: "ping", data: { n: 1 }, origin: "CoreContext" }]);
	});

	it("goes from the background to the main thread the same way", async () => {
		const page = startTestPage();
		const { main, background } = contexts(page);
		const heard: unknown[] = [];
		main.addEventListener("pong", (event) => heard.push(event));
		background.dispatchEvent({ type: "pong", data: "x" });
		expect(heard).toEqual([]);
		await page.settle();
		expect(heard).toEqual([{ type: "pong", data: "x", origin: "JSContext" }]);
	});

	it("reaches only the other thread's listeners of its type, and not one that was removed", async () => {
		const page = startTestPage();
		const { main, background } = contexts(page);
		const heard: string[] = [];
		const removed = () => heard.push("removed");
		background.addEventListener("ping", () => heard.push("background"));
		background.addEventListener("ping", removed);
		background.removeEventListener("ping", removed);
		background.addEventListener("other", () => heard.push("other"));
		main.addEventListener("ping", () => heard.push("main thread"));
		main.dispatchEvent({ type: "ping", data: null });
		await page.settle();
		expect(heard).toEqual(["background"]);
	});

	it("arrives as a copy made when it was sent: a later change to the sent value does not arrive", async () => {
		const page = startTestPage();
		const { main, background } = contexts(page);
		const heard: unknown[] = [];
		background.addEventListener("ops", (event) => heard.push(event.data));
		const ops = [1, 2];
		main.dispatchEvent({ type: "ops", data: ops });
		ops.push(3);
		await page.settle();
		expect(heard).toEqual([[1, 2]]);
		expect(heard[0]).not.toBe(ops);
	});

	it("carries plain data made in another realm, as each thread is on a device", async () => {
		const page = startTestPage();
		const { main, background } = contexts(page);
		const heard: unknown[] = [];
		background.addEventListener("ops", (event) => heard.push(event.data));
		const data: unknown = vm.runInNewContext("({ ops: [1, { at: 'a' }], none: null })");
		main.dispatchEvent({ type: "ops", data });
		await page.settle();
		expect(heard).toEqual([{ ops: [1, { at: "a" }], none: null }]);
	});

	it.each([
		["a function", () => {}],
		["a DOM node", "node"],
		["a Map", new Map()],
		["a class instance", new (class Op {})()],
		["a class instance made in another realm", vm.runInNewContext("new (class Op {})()")],
		["a number that is not finite", Number.NaN],
		["a cycle", "cycle"],
	])("is refused when it holds %s, naming the message", (_name, value) => {
		const page = startTestPage();
		const data: Record<string, unknown> = { value };
		if (value === "node") data["value"] = document.createElement("div");
		if (value === "cycle") data["value"] = data;
		expect(() => contexts(page).main.dispatchEvent({ type: "ops", data })).toThrow(
			"The ops message between the threads holds",
		);
	});

	it("arrives even while the test fakes timers", async () => {
		const page = startTestPage();
		rs.useFakeTimers();
		const { main, background } = contexts(page);
		const heard: unknown[] = [];
		background.addEventListener("ping", (event) => heard.push(event.data));
		main.dispatchEvent({ type: "ping", data: 1 });
		await page.settle();
		expect(heard).toEqual([1]);
	});

	it("is dropped once the page has ended", async () => {
		const page = startTestPage();
		const { main, background } = contexts(page);
		const heard: unknown[] = [];
		background.addEventListener("ping", (event) => heard.push(event.data));
		main.dispatchEvent({ type: "ping", data: 1 });
		page.dispose();
		await new Promise((resolve) => setImmediate(resolve));
		expect(heard).toEqual([]);
	});

	it("that throws in the receiving thread goes to the page's errors, and the rest still arrive", async () => {
		const page = startTestPage();
		const { main, background } = contexts(page);
		const heard: unknown[] = [];
		const boom = new Error("boom");
		background.addEventListener("ping", () => {
			throw boom;
		});
		background.addEventListener("pong", (event) => heard.push(event.data));
		main.dispatchEvent({ type: "ping", data: 1 });
		main.dispatchEvent({ type: "pong", data: 2 });
		await page.settle();
		expect(heard).toEqual([2]);
		expect(page.errors).toContain(boom);
	});
});

describe("each thread's lynx", () => {
	it("has only what that thread has on a device", () => {
		const page = startTestPage();
		const own = (value: object) => Object.keys(value).toSorted();
		expect(own(page.lynx.mainThread)).toEqual([
			"__globalProps",
			"__initData",
			"clearTimeout",
			"getEngine",
			"getJSContext",
			"getNative",
			"reportError",
			"setTimeout",
		]);
		expect(own(page.lynx.background)).toEqual([
			"__globalProps",
			"__initData",
			"getApp",
			"getCoreContext",
			"getNativeApp",
			"queueMicrotask",
			"reportError",
		]);
	});

	it("is the global lynx while that thread runs a delivery", async () => {
		const page = startTestPage();
		const { main, background } = contexts(page);
		const seen: unknown[] = [];
		background.addEventListener("ping", () => {
			seen.push(readGlobal("lynx"));
			background.dispatchEvent({ type: "pong", data: null });
		});
		main.addEventListener("pong", () => seen.push(readGlobal("lynx")));
		main.dispatchEvent({ type: "ping", data: null });
		await page.settle();
		expect(seen).toEqual([page.lynx.background, page.lynx.mainThread]);
	});

	it("is the main thread's while the engine runs the page's code, and stays until the next thread runs", async () => {
		const page = startTestPage();
		const { main, background } = contexts(page);
		const f = page.engine.functions;
		const seen: unknown[] = [];
		const root = f.__CreatePage("0", 0);
		f.__AddEventListener(root, "tap", () => seen.push(readGlobal("lynx")), {});
		background.addEventListener("ping", () => undefined);
		main.dispatchEvent({ type: "ping", data: null });
		await page.settle();
		expect(readGlobal("lynx")).toBe(page.lynx.background);
		page.engine.dispatch(root, { type: "tap" });
		expect(seen).toEqual([page.lynx.mainThread]);
		expect(readGlobal("lynx")).toBe(page.lynx.mainThread);
	});
});

describe("settle", () => {
	it("waits for what a delivery sends in turn", async () => {
		const page = startTestPage();
		const { main, background } = contexts(page);
		const heard: string[] = [];
		background.addEventListener("ping", () => {
			heard.push("ping");
			background.dispatchEvent({ type: "pong", data: null });
		});
		main.addEventListener("pong", () => heard.push("pong"));
		main.dispatchEvent({ type: "ping", data: null });
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
		const { main, background } = contexts(page);
		background.addEventListener("ping", () => background.dispatchEvent({ type: "ping", data: 0 }));
		main.addEventListener("ping", () => main.dispatchEvent({ type: "ping", data: 0 }));
		main.dispatchEvent({ type: "ping", data: 0 });
		await expect(page.settle()).rejects.toThrow("still sending after 100 rounds");
		page.dispose();
	});
});

describe("the main thread's setTimeout", () => {
	it("runs a callback with no delay on a later task, which settle waits for", async () => {
		const page = startTestPage();
		const ran: unknown[] = [];
		page.lynx.mainThread.setTimeout(() => ran.push(readGlobal("lynx")));
		expect(ran).toEqual([]);
		await page.settle();
		expect(ran).toEqual([page.lynx.mainThread]);
	});

	it("waits out a delay in the process's time, which settle does not wait for", async () => {
		const page = startTestPage();
		rs.useFakeTimers();
		const ran: string[] = [];
		page.lynx.mainThread.setTimeout(() => ran.push("late"), 100);
		await page.settle();
		expect(ran).toEqual([]);
		rs.advanceTimersByTime(100);
		await page.settle();
		expect(ran).toEqual(["late"]);
	});

	it("runs nothing once cleared, with a delay or without", async () => {
		const page = startTestPage();
		const lynx = page.lynx.mainThread;
		const ran: string[] = [];
		lynx.clearTimeout(lynx.setTimeout(() => ran.push("soon")));
		lynx.clearTimeout(lynx.setTimeout(() => ran.push("late"), 1));
		lynx.clearTimeout({ canceled: false });
		await new Promise((resolve) => setTimeout(resolve, 5));
		await page.settle();
		expect(ran).toEqual([]);
	});
});

describe("callLepusMethod", () => {
	it("calls the main thread's global function on a later task, and calls back on a task after", async () => {
		const page = startTestPage();
		const order: string[] = [];
		const restore = installGlobals({
			patch: (params: unknown) => order.push(`patch ${JSON.stringify(params)}`),
		});
		page.lynx.background
			.getNativeApp()
			.callLepusMethod("patch", { data: "1" }, () => order.push("callback"));
		order.push("sent");
		await new Promise((resolve) => setImmediate(resolve));
		order.push("one task later");
		await page.settle();
		expect(order).toEqual(["sent", 'patch {"data":"1"}', "one task later", "callback"]);
		restore();
	});

	it("sends a copy of its params, made when it was called", async () => {
		const page = startTestPage();
		const received: unknown[] = [];
		const restore = installGlobals({ patch: (params: unknown) => received.push(params) });
		const params = { ops: [1] };
		page.lynx.background.getNativeApp().callLepusMethod("patch", params);
		params.ops.push(2);
		await page.settle();
		expect(received).toEqual([{ ops: [1] }]);
		restore();
	});

	it("reports a method the main thread does not have, as Lynx does", async () => {
		const page = startTestPage();
		page.lynx.background.getNativeApp().callLepusMethod("missing", {});
		await page.settle();
		expect(page.errors).toContainEqual(
			expect.objectContaining({ message: expect.stringContaining("callLepusMethod") }),
		);
	});
});
