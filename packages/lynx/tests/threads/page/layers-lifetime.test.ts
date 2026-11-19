// A layer lives only while its page does: it goes with the page when the page closes or reloads,
// and `mount` needs a running page on the background. A layer an effect mounts is not in the first
// frame, which runs no effect; hydration keeps every element the frame drew.

import { describe, expect, it } from "@rstest/core";

import { mount } from "../../../src/background/root-entry.ts";
import type { LynxElement } from "../../../src/testing/index.ts";
import Layer from "../../fixtures/threads/page/Layer.svelte";
import LayerHost from "../../fixtures/threads/page/LayerHost.svelte";
import LayerInEffect from "../../fixtures/threads/page/LayerInEffect.svelte";
import drawLayerInEffect from "../../fixtures/threads/page/LayerInEffect.svelte?first-frame";
import MainThreadProbe from "../../fixtures/threads/page/MainThreadProbe.svelte";
import drawMainThreadProbe from "../../fixtures/threads/page/MainThreadProbe.svelte?first-frame";
import { startSveltePage } from "../svelte-page.ts";

type Instance = Record<string, unknown>;

/** What `run` throws. */
function thrownBy(run: () => unknown): unknown {
	try {
		run();
	} catch (error) {
		return error;
	}
	throw new Error("It threw nothing.");
}

async function withALayerOpen() {
	const log: unknown[] = [];
	const handles: Record<string, unknown> = {};
	const page = startSveltePage(LayerHost, { props: () => ({ handles, log }) });
	await page.settle();
	const listeners = page.engine.listenerCount();
	page.asBackground(() =>
		(handles["open"] as (label: string, context: boolean) => Instance)("open", true),
	);
	await page.settle();
	expect(
		page.engine.all().some((element) => page.engine.state(element).classes === "layer open"),
	).toBe(true);
	const rootChildren = () =>
		[...(page.engine.page() as Element).children].map(
			(child) => page.engine.state(child as LynxElement).classes,
		);
	return { page, log, listeners, rootChildren };
}

describe("mount with no page running", () => {
	const late = () => mount(Layer, { props: { label: "late", log: [] } });

	// First in the file: no page has run yet.
	it("throws one error before a page starts", () => {
		expect(thrownBy(late)).toMatchObject({
			code: "mount_without_page",
			message: expect.stringMatching(/^A call of mount ran with no page running/),
		});
	});

	it("throws it after the page closed", async () => {
		const { page } = await withALayerOpen();
		page.destroy();
		await page.settle();
		expect(thrownBy(() => page.asBackground(late))).toMatchObject({ code: "mount_without_page" });
	});
});

describe("a layer", () => {
	it("goes when the page closes, and nothing of it is left", async () => {
		const { page, log } = await withALayerOpen();
		page.destroy();
		await page.settle();
		expect(log).toContain("destroyed open");
		expect(page.engine.listenerCount()).toBe(0);
		expect(page.errors).toEqual([]);
	});

	it("goes when the page reloads: the new app starts alone", async () => {
		const { page, log, listeners, rootChildren } = await withALayerOpen();
		page.reload();
		await page.settle();
		expect(log).toContain("destroyed open");
		expect(rootChildren()).toEqual(["page", "tail"]);
		expect(page.engine.listenerCount()).toBe(listeners);
		expect(page.errors).toEqual([]);
	});
});

describe("on the main thread", () => {
	it("mount, unmount, createStaticCopy and the root each throw one error, as the first frame is drawn", () => {
		const page = startSveltePage(MainThreadProbe, {
			props: { probe: false },
			firstFrame: { draw: drawMainThreadProbe, props: { probe: true } },
		});
		// Before the background answers.
		expect(page.engine.texts()).toEqual(Array(5).fill("called_on_main_thread"));
	});
});

describe("the first frame", () => {
	it("draws nothing of a layer an effect mounts, and hydration keeps what it drew", async () => {
		const log: unknown[] = [];
		const page = startSveltePage(LayerInEffect, {
			props: { log },
			firstFrame: { draw: drawLayerInEffect, props: { log } },
		});
		const drawn = page.engine.all();
		const classes = () =>
			[...(page.engine.page() as Element).children].map(
				(child) => page.engine.state(child as LynxElement).classes,
			);
		expect(classes()).toEqual(["page", "tail"]);
		await page.settle();
		expect(classes()).toEqual(["page", "tail", "layer effect"]);
		const now = new Set(page.engine.all());
		for (const element of drawn) expect(now.has(element)).toBe(true);
		expect(page.errors).toEqual([]);
	});
});
