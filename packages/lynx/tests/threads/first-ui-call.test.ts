// The first UI method on an element, and layout-only views. Lynx makes an element's UI when the
// tree is flushed, and makes none for a <view> with no attribute, no event and only layout styles,
// so a UI method on a new element or on a layout-only one answers "no UI for this node" (code 6)
// (the engine fake answers both ways). So the element gets `flatten` false, an attribute, and every
// UI method waits for the patch's flush: Lynx is asked once, after it has made the UI and taken the
// update. Writes after it do not wait.

import { describe, expect, it } from "@rstest/core";

import type { ElementNode } from "../../src/background/renderer/element.ts";
import FirstCall from "../fixtures/threads/FirstCall.svelte";
import { startSveltePage } from "./svelte-page.ts";

/** Where the element is, as the engine knows it once it has a UI. */
const RIGHT = { left: 12, top: 200, width: 30, height: 40 };

async function firstCall() {
	const handles: Record<string, unknown> = {};
	const page = startSveltePage(FirstCall, { props: () => ({ handles }) });
	await page.settle();
	page.engine.respondWith(() => ({ code: 0, data: RIGHT }));
	const measure = async (name: string) => {
		const answer = page.asBackground(() =>
			(handles[name] as ElementNode).invoke("boundingClientRect"),
		);
		answer.catch(() => {});
		await page.settle();
		return answer;
	};
	const tap = async (token: string) => {
		page.engine.dispatch(page.byClass(token), { type: "tap" });
		await page.settle();
	};
	return { page, handles, measure, tap };
}

describe("the first UI method on an element", () => {
	it("waits for the flush that gives a layout-only view a UI, and gets its place", async () => {
		const { page, measure } = await firstCall();
		const flushes = page.engine.flushes.length;
		await expect(measure("a")).resolves.toEqual(RIGHT);
		expect(page.engine.state(page.byClass("a")).attrs["flatten"]).toBe(false);
		// One engine call, after the patch's flush, its only one.
		expect(page.engine.invocations.map((call) => [call.code, call.flushesBefore])).toEqual([
			[0, flushes + 1],
		]);
		expect(page.engine.flushes.length - flushes).toBe(1);
	});

	it("is one engine call, after the flush, on an element that has its view", async () => {
		const { page, measure } = await firstCall();
		await measure("a");
		const flushes = page.engine.flushes.length;
		await expect(measure("a")).resolves.toEqual(RIGHT);
		expect(page.engine.invocations.at(-1)!.flushesBefore).toBe(flushes + 1);
		expect(page.engine.flushes.length - flushes).toBe(1);
	});

	it("is one engine call, after the flush, on a view the app unflattened itself", async () => {
		const { page, measure } = await firstCall();
		const flushes = page.engine.flushes.length;
		await expect(measure("own")).resolves.toEqual(RIGHT);
		expect(page.engine.invocations.map((call) => [call.code, call.flushesBefore])).toEqual([
			[0, flushes + 1],
		]);
	});

	it("unflattens a view the app flattened, whose UI lacks a full view's methods", async () => {
		const { page, measure } = await firstCall();
		await expect(measure("told")).resolves.toEqual(RIGHT);
		expect(page.engine.state(page.byClass("told")).attrs["flatten"]).toBe(false);
		expect(page.engine.invocations.map((call) => call.code)).toEqual([0]);
	});

	it("keeps the order of the calls: one that waits holds back the ones after it", async () => {
		const { page, handles, measure, tap } = await firstCall();
		await measure("a");
		page.engine.invocations.length = 0;
		await tap("pair");
		expect(page.engine.invocations.map((call) => call.element)).toEqual([
			page.byClass("b"),
			page.byClass("a"),
		]);
		expect([handles["result-b"], handles["result-a"]]).toEqual([RIGHT, RIGHT]);
	});

	it("waits for the flush that makes a new element, so Lynx is asked once", async () => {
		const { page, handles, tap } = await firstCall();
		await tap("add");
		expect(page.engine.invocations.map((call) => [call.element, call.code])).toEqual([
			[page.byClass("fresh"), 0],
		]);
		expect(handles["result-fresh"]).toEqual(RIGHT);
	});

	it("waits for the flush on an element that has its view, so it sees the update", async () => {
		const { page, measure, tap } = await firstCall();
		await measure("a");
		const seen: unknown[] = [];
		page.engine.respondWith((_method, _params, _element, shown) => {
			seen.push(shown?.classes);
			return { code: 0, data: RIGHT };
		});
		const flushes = page.engine.flushes.length;
		await tap("widen");
		expect(seen).toEqual(["a wide"]);
		expect(page.engine.invocations.at(-1)!.flushesBefore).toBe(flushes + 1);
	});

	it("lets a write after a waiting call land before the patch's flush", async () => {
		const { page, tap } = await firstCall();
		const order: string[] = [];
		const functions = page.engine.functions;
		const { __AddInlineStyle: add, __FlushElementTree: flush } = functions;
		functions.__AddInlineStyle = (element, name, value) => {
			order.push(`style ${name}`);
			add(element, name, value);
		};
		functions.__FlushElementTree = (element, options) => {
			order.push("flush");
			flush(element, options);
		};
		await tap("add");
		Object.assign(functions, { __AddInlineStyle: add, __FlushElementTree: flush });
		expect(order).toEqual(["style color", "flush"]);
		expect(page.engine.state(page.byClass("fresh")).inlineStyles.get("color")).toBe("red");
	});

	it("fails with a clear message when Lynx still finds no view on the screen", async () => {
		const { page, measure } = await firstCall();
		page.engine.respondWith(() => ({ code: 6 }));
		const failure = measure("own");
		await expect(failure).rejects.toMatchObject({
			code: "element_has_no_view",
			message: expect.stringMatching(
				/^Lynx could not run boundingClientRect: .*no view on the screen/,
			),
		});
		await expect(failure).rejects.toMatchObject({
			message: expect.not.stringContaining("flatten={false}"),
		});
		expect(page.errors).toEqual([]);
	});

	it("leaves an element nothing calls as it is", async () => {
		const { page, measure } = await firstCall();
		await measure("a");
		expect(page.engine.state(page.byClass("idle")).attrs["flatten"]).toBeUndefined();
		expect(page.errors).toEqual([]);
	});
});
