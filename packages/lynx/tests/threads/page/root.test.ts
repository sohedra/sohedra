// `root`: the page's root node, one value for the runtime's life, which Svelte's `on()` listens on.
// A capture listener on it hears the touches of every element of the page, a layer's included,
// before their own handlers, and a handler that catches below does not stop it. Before a page
// starts it is a node not on the page yet, whose listeners are bound when the page starts; once the
// page is gone, no listener of it is called and nothing it is asked throws.

import { describe, expect, it } from "@rstest/core";
import type { LynxNode } from "@sohedra/lynx/elements";
import { on } from "svelte/events";

import { root } from "../../../src/background/root-entry.ts";
import type { LynxElement } from "../../../src/testing/index.ts";
import PageRoot from "../../fixtures/threads/page/PageRoot.svelte";
import drawPageRoot from "../../fixtures/threads/page/PageRoot.svelte?first-frame";
import { startSveltePage } from "../svelte-page.ts";
import type { SveltePage } from "../svelte-page.ts";

interface Heard {
	type: string;
	target: LynxNode;
	currentTarget: unknown;
}

const TOUCHES = ["touchstart", "touchmove", "touchend", "tap"];

/** The listeners of the Lynx page element for one event name. */
const bound = (page: SveltePage, name: string) =>
	page.engine.state(page.engine.page()!).listeners.filter((entry) => entry.name === name);

/** Touches an element as Lynx does, and waits for both threads. */
async function touch(page: SveltePage, element: LynxElement, type: string): Promise<void> {
	page.engine.dispatch(element, { type });
	await page.settle();
}

function pageRoot(options: { listen?: boolean; firstFrame?: boolean } = {}) {
	const handles: Record<string, unknown> = {};
	const log: unknown[] = [];
	const heard: Heard[] = [];
	const props = { handles, log, heard, listen: options.listen ?? false };
	const page = startSveltePage(PageRoot, {
		props: () => props,
		...(options.firstFrame && { firstFrame: { draw: drawPageRoot, props } }),
	});
	return { page, handles, log, heard };
}

describe("while no page runs", () => {
	// Whether a page ran before or not: none runs now.
	it("the root is a node not on the page, whose listener is bound once the page starts", async () => {
		const early: string[] = [];
		const hear = (event: Heard) => void early.push(event.type);
		expect(root.tag).toBe("page");
		expect(root.isConnected).toBe(false);
		root.addEventListener("tap", hear, { capture: true });
		const { page } = pageRoot();
		await page.settle();
		expect(root.isConnected).toBe(true);
		expect(bound(page, "tap")).toHaveLength(1);
		await touch(page, page.byClass("plain"), "tap");
		expect(early).toEqual(["tap"]);
		page.asBackground(() => root.removeEventListener("tap", hear, { capture: true }));
		await page.settle();
		expect(bound(page, "tap")).toHaveLength(0);
	});
});

describe("the root", () => {
	it("is the same value for every page and every reload", async () => {
		const before = root;
		const { page } = pageRoot();
		await page.settle();
		page.reload();
		await page.settle();
		expect(root).toBe(before);
		expect(root.tag).toBe("page");
		expect(root.isConnected).toBe(true);
	});

	it("holds the page's nodes", async () => {
		const { page, handles } = pageRoot();
		await page.settle();
		expect(root.contains(root)).toBe(true);
		expect(root.contains(handles["plain"] as LynxNode)).toBe(true);
	});
});

describe("a capture listener on the root", () => {
	/** A page whose root hears its touches, with a layer open above it. */
	async function capturing() {
		const { page, handles, log } = pageRoot();
		await page.settle();
		const heard: Heard[] = [];
		const hear = (event: Heard) => void heard.push(event);
		page.asBackground(() => {
			for (const type of TOUCHES) root.addEventListener(type, hear, { capture: true });
		});
		// A layer, mounted with the package's mount.
		await touch(page, page.byClass("open"), "tap");
		heard.length = 0;
		return { page, handles, log, heard, hear };
	}

	it.each(TOUCHES)(
		"hears %s from an element of the page, with that node as the target",
		async (type) => {
			const { page, handles, heard } = await capturing();
			await touch(page, page.byClass("plain"), type);
			expect(heard).toHaveLength(1);
			expect(heard[0]).toMatchObject({ type, target: handles["plain"], currentTarget: root });
		},
	);

	it.each(TOUCHES)("hears %s from an element of a layer", async (type) => {
		const { page, heard } = await capturing();
		await touch(page, page.byClass("mt"), type);
		expect(heard).toHaveLength(1);
		expect(heard[0]!.currentTarget).toBe(root);
		expect(root.contains(heard[0]!.target)).toBe(true);
	});

	it("has the root as the target of a touch on the page element itself", async () => {
		const { page, heard } = await capturing();
		await touch(page, page.engine.page()!, "tap");
		expect(heard).toEqual([expect.objectContaining({ target: root, currentTarget: root })]);
	});

	it("is not stopped by a handler that catches below it", async () => {
		const { page, log, heard } = await capturing();
		log.length = 0;
		await touch(page, page.byClass("caught"), "tap");
		expect(log).toEqual(["caught"]);
		expect(heard.map((event) => event.type)).toEqual(["tap"]);
	});

	it("keeps the page element bound until the last listener of its kind goes", async () => {
		const { page, heard, hear } = await capturing();
		const other = (event: Heard) => void heard.push({ ...event, type: "other" });
		page.asBackground(() => root.addEventListener("tap", other, { capture: true }));
		await page.settle();
		expect(bound(page, "tap")).toHaveLength(1);
		page.asBackground(() => root.removeEventListener("tap", hear, { capture: true }));
		await page.settle();
		await touch(page, page.byClass("plain"), "tap");
		expect(heard.map((event) => event.type)).toEqual(["other"]);
		page.asBackground(() => root.removeEventListener("tap", other, { capture: true }));
		await page.settle();
		expect(bound(page, "tap")).toHaveLength(0);
		expect(page.errors).toEqual([]);
	});

	it("is bound apart from a listener without capture", async () => {
		const { page } = await capturing();
		const plain: string[] = [];
		const listener = (event: Heard) => void plain.push(event.type);
		page.asBackground(() => root.addEventListener("touchstart", listener));
		await page.settle();
		expect(bound(page, "touchstart")).toHaveLength(2);
		await touch(page, page.byClass("plain"), "touchstart");
		expect(plain).toEqual(["touchstart"]);
		page.asBackground(() => root.removeEventListener("touchstart", listener));
		await page.settle();
		expect(bound(page, "touchstart")).toHaveLength(1);
	});
});

describe("on(root, …) in an effect", () => {
	it("is bound by the patch that hydrates the first frame, hears the page, and goes with the effect", async () => {
		const { page, handles, heard } = pageRoot({ listen: true, firstFrame: true });
		const drawn = page.engine.all();
		await page.settle();
		expect(page.engine.all()).toEqual(drawn);
		for (const type of TOUCHES) expect(bound(page, type)).toHaveLength(1);
		for (const type of TOUCHES) await touch(page, page.byClass("plain"), type);
		expect(heard.map((event) => [event.type, event.target === handles["plain"]])).toEqual(
			TOUCHES.map((type) => [type, true]),
		);
		page.asBackground(() => (handles["listening"] as (value: boolean) => void)(false));
		await page.settle();
		for (const type of TOUCHES) expect(bound(page, type)).toHaveLength(0);
		heard.length = 0;
		await touch(page, page.byClass("plain"), "tap");
		expect(heard).toEqual([]);
		expect(page.errors).toEqual([]);
	});

	it("listens from a handler too, where no effect runs", async () => {
		const { page } = pageRoot();
		await page.settle();
		const taps: string[] = [];
		const off = page.asBackground(() =>
			on(root, "tap", (event) => void taps.push(event.type), { capture: true }),
		);
		await page.settle();
		await touch(page, page.byClass("plain"), "tap");
		expect(taps).toEqual(["tap"]);
		page.asBackground(off);
		await page.settle();
		expect(bound(page, "tap")).toHaveLength(0);
	});
});

describe("once the page is gone", () => {
	it("calls no listener of the root, and throws nothing it is asked", async () => {
		const { page, handles } = pageRoot();
		await page.settle();
		const heard: string[] = [];
		const hear = (event: Heard) => void heard.push(event.type);
		page.asBackground(() => {
			root.addEventListener("tap", hear, { capture: true });
			root.addEventListener("touchstart", hear);
		});
		await page.settle();
		// The background's page ends first: Lynx's listener is still on the page element.
		page.asBackground(() => (page.app["callDestroyLifetimeFun"] as () => void)());
		await page.settle();
		await touch(page, page.engine.page()!, "tap");
		await touch(page, page.engine.page()!, "touchstart");
		expect(heard).toEqual([]);
		page.asBackground(() => {
			expect(() => root.addEventListener("tap", hear, { capture: true })).not.toThrow();
			expect(() => root.removeEventListener("tap", hear, { capture: true })).not.toThrow();
			expect(() => root.removeEventListener("touchstart", hear)).not.toThrow();
		});
		expect(root.isConnected).toBe(false);
		expect(root.contains(handles["plain"] as LynxNode)).toBe(false);
		expect(page.errors).toEqual([]);
	});
});
