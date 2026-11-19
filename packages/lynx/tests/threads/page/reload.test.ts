// A page that reloads: the old app's work that reaches the background after the reload, an error
// of its teardown, and what the threads hold after a reload, which is the same after the second:
// no handler, context, node, layer, ref, listener or detector of the old app stays behind.

import { describe, expect, it } from "@rstest/core";

import { keptContexts } from "../../../src/background/functions/calls.ts";
import type { ElementNode } from "../../../src/background/renderer/element.ts";
import { pageHandlers, pageRenderer } from "../../../src/background/renderer/page-renderer.ts";
import CallsBackground from "../../fixtures/threads/page/CallsBackground.svelte";
import drawCallsBackground from "../../fixtures/threads/page/CallsBackground.svelte?first-frame";
import Reloaded from "../../fixtures/threads/page/Reloaded.svelte";
import drawReloaded from "../../fixtures/threads/page/Reloaded.svelte?first-frame";
import TeardownThrows from "../../fixtures/threads/page/TeardownThrows.svelte";
import { liveDetectors } from "../gestures/detectors.ts";
import { startSveltePage } from "../svelte-page.ts";
import type { SveltePage } from "../svelte-page.ts";

/** Keeps what the main thread sends the background until `deliver` is called. */
function holdMessages(page: SveltePage) {
	const context = page.lynx.mainThread.getJSContext();
	const send = context.dispatchEvent;
	const held: Parameters<typeof send>[0][] = [];
	context.dispatchEvent = (event) => void held.push(event);
	return {
		held,
		deliver() {
			context.dispatchEvent = send;
			for (const event of held.splice(0)) send.call(context, event);
		},
	};
}

function callsBackground() {
	const log: unknown[] = [];
	const handles: Record<string, unknown> = {};
	// The first-frame copy registers the main-thread function; no frame is drawn.
	void drawCallsBackground;
	const page = startSveltePage(CallsBackground, { props: { log, handles } });
	return { page, log, handles };
}

describe("the old app's work that reaches the background after a reload", () => {
	it("is dropped: a call of a background function its main-thread function made before", async () => {
		const { page, log } = callsBackground();
		await page.settle();
		const calls = holdMessages(page);
		page.engine.dispatch(page.byClass("main"), { type: "tap" });
		await page.settle();
		expect(calls.held).toHaveLength(1);
		page.reload();
		calls.deliver();
		await page.settle();
		expect(log).toEqual([]);
		expect(page.errors).toEqual([]);
		// The new app's own call is heard.
		page.engine.dispatch(page.byClass("main"), { type: "tap" });
		await page.settle();
		expect(log).toEqual(["main-thread tap"]);
	});

	it("rejects a UI call the old app made, whatever the main thread answered", async () => {
		const { page, handles } = callsBackground();
		await page.settle();
		const replies = holdMessages(page);
		const asked = page.asBackground(() =>
			(handles["node"] as ElementNode).invoke("boundingClientRect"),
		);
		asked.catch(() => {});
		await page.settle();
		expect(replies.held).toHaveLength(1);
		page.reload();
		replies.deliver();
		await page.settle();
		await expect(asked).rejects.toMatchObject({ code: "page_is_gone" });
		expect(page.errors).toEqual([]);
	});
});

describe("the old app's teardown", () => {
	it("is reported once when it throws, and the new app starts", async () => {
		const page = startSveltePage(TeardownThrows);
		await page.settle();
		const unhandled: unknown[] = [];
		const onUnhandled = (reason: unknown) => void unhandled.push(reason);
		process.on("unhandledRejection", onUnhandled);
		try {
			page.reload();
			await page.settle();
			await new Promise((resolve) => setTimeout(resolve, 10));
		} finally {
			process.off("unhandledRejection", onUnhandled);
		}
		expect(page.errors.map(String)).toEqual(["Error: teardown failed"]);
		expect(unhandled).toEqual([]);
		expect(page.engine.texts()).toEqual(["root"]);
	});
});

describe("reloading a page twice", () => {
	/** What each thread holds of the page. */
	function counts(page: SveltePage) {
		const held = page.runtime.page.functions.sizes();
		let nodes = 0;
		for (let id = 0; id < 2000; id++) if (pageRenderer.nodeById(id)) nodes++;
		return {
			handlers: pageHandlers.size,
			contexts: page.asBackground(keptContexts).length,
			nodes,
			layers: page.engine
				.all()
				.filter((element) => page.engine.state(element).classes.startsWith("layer")).length,
			elements: page.engine.all().length,
			listeners: page.engine.listenerCount(),
			refs: held.refs,
			bindings: held.bindings,
			detectors: liveDetectors(page),
		};
	}

	/** Lynx shows the list's rows, as when they scroll into view. */
	function showRows(page: SveltePage): void {
		const list = page.byClass("feed");
		for (let index = 0; index < 3; index++) page.engine.list(list).ask(index);
	}

	async function reload(page: SveltePage): Promise<void> {
		page.reload();
		await page.settle();
	}

	it("leaves the same behind the second time as the first, which is what the page holds", async () => {
		const log: unknown[] = [];
		const handles: Record<string, unknown> = {};
		// The first-frame copy registers the main-thread functions; no frame is drawn.
		void drawReloaded;
		const page = startSveltePage(Reloaded, { props: () => ({ log, handles }) });
		await page.settle();
		showRows(page);
		// A UI call whose answer is on its way at the reload.
		const asked = page.asBackground(() =>
			(handles["node"] as ElementNode).invoke("boundingClientRect"),
		);
		asked.catch(() => {});
		await reload(page);
		showRows(page);
		await page.settle();
		const first = counts(page);
		await reload(page);
		showRows(page);
		await page.settle();
		expect(counts(page)).toEqual(first);
		// One layer, the root's listener and the page's own taps; a ref and a gesture's detector.
		expect(first).toMatchObject({ layers: 1, refs: 1, detectors: 1 });
		log.length = 0;
		page.engine.dispatch(page.byClass("tap"), { type: "tap" });
		await page.settle();
		expect(log).toEqual(["root tap", "tap"]);
		expect(page.errors).toEqual([]);
	});
});
