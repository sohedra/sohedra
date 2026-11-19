// `mount` and `unmount`: a layer drawn above the page, under its root, from an effect, a tap, a
// timer and a promise. It comes after everything the page drew; its taps, on the background and
// on the main thread, reach their handlers; it sees the context it is given; and `unmount` takes
// it away at once and leaves the page as it was.

import { describe, expect, it } from "@rstest/core";

import { mount, unmount } from "../../../src/background/root-entry.ts";
import type { LynxElement } from "../../../src/testing/index.ts";
import LayerHost from "../../fixtures/threads/page/LayerHost.svelte";
import drawLayerHost from "../../fixtures/threads/page/LayerHost.svelte?first-frame";
import TeardownThrows from "../../fixtures/threads/page/TeardownThrows.svelte";
import Titled from "../../fixtures/threads/page/Titled.svelte";
import { startSveltePage } from "../svelte-page.ts";
import type { SveltePage } from "../svelte-page.ts";

type Instance = Record<string, unknown>;
type Handles = Record<string, unknown> & {
	open(label: string, withContext: boolean, place?: object): Instance;
	fromPromise(label: string): Promise<Instance>;
};

/** What the page drew itself, under its root. */
const PAGE = ["page", "tail"];

async function host(inEffect = true) {
	const log: unknown[] = [];
	const handles = {} as Handles;
	// The host's first-frame copy registers the layer's main-thread function; no frame is drawn.
	void drawLayerHost;
	const page = startSveltePage(LayerHost, { props: () => ({ handles, log, inEffect }) });
	await page.settle();
	/** The classes of what the page's root holds, in order. */
	const rootChildren = () =>
		[...(page.engine.page() as Element).children].map(
			(child) => page.engine.state(child as LynxElement).classes,
		);
	const themeOf = (label: string) =>
		page.engine.text((page.byClass(label) as Element).firstElementChild as LynxElement);
	/** Runs `run` on the background from a timer, where no effect or handler runs. */
	const later = <T>(run: () => T) =>
		new Promise<T>((resolve) => setTimeout(() => resolve(page.asBackground(run))));
	const open = async (label: string, withContext = true, place?: object) => {
		const layer = await later(() => handles.open(label, withContext, place));
		await page.settle();
		return layer;
	};
	return { page, log, handles, rootChildren, themeOf, open, later };
}

/** Taps an element, as Lynx does, and waits for both threads. */
async function tap(page: SveltePage, element: LynxElement): Promise<void> {
	page.engine.dispatch(element, { type: "tap" });
	await page.settle();
}

describe("mount", () => {
	it("draws a layer an effect mounts after the page's own elements", async () => {
		const { page, rootChildren } = await host();
		expect(rootChildren()).toEqual([...PAGE, "layer effect"]);
		expect(page.errors).toEqual([]);
	});

	it("draws one a tap's handler mounts", async () => {
		const { page, rootChildren } = await host();
		await tap(page, page.byClass("open"));
		expect(rootChildren()).toEqual([...PAGE, "layer effect", "layer handler"]);
	});

	it("draws one a timer and one a promise mount, where no effect runs", async () => {
		const { page, handles, rootChildren, open } = await host();
		await open("timer");
		await page.asBackground(() => handles.fromPromise("promise"));
		await page.settle();
		expect(rootChildren()).toEqual([...PAGE, "layer effect", "layer timer", "layer promise"]);
		expect(page.errors).toEqual([]);
	});

	it("runs a layer's tap handler, and its main-thread handler", async () => {
		const { page, log, open } = await host();
		await open("timer");
		await tap(page, page.byClass("timer"));
		expect(log).toEqual(["tap timer"]);
		log.length = 0;
		const target = (page.byClass("timer") as Element).lastElementChild as LynxElement;
		await tap(page, target);
		// The tap goes on up to the layer's own handler, after the main-thread one.
		expect(log).toEqual(["main-thread tap", "tap timer"]);
		expect(page.errors).toEqual([]);
	});

	it("gives a layer the context it is given, and none otherwise", async () => {
		const { page, handles, themeOf, open } = await host();
		await open("given");
		await page.asBackground(() => handles.fromPromise("promise"));
		await page.settle();
		await open("bare", false);
		await tap(page, page.byClass("open"));
		expect(themeOf("given")).toBe("dark");
		expect(themeOf("promise")).toBe("dark");
		// Mounted outside the component's own code, the layer inherits nothing.
		expect(themeOf("handler")).toBe("none");
		expect(themeOf("bare")).toBe("none");
	});

	it("draws under a target, and before an anchor in it", async () => {
		const { page, handles, rootChildren, open } = await host();
		const box = () =>
			[...(page.byClass("box") as Element).children].map(
				(child) => page.engine.state(child as LynxElement).classes,
			);
		await open("inbox", true, { target: handles["box"] });
		expect(box()).toEqual(["first", "second", "layer inbox"]);
		await open("anchored", true, { target: handles["box"], anchor: handles["first"] });
		expect(box()).toEqual(["layer anchored", "first", "second", "layer inbox"]);
		expect(rootChildren()).toEqual([...PAGE, "layer effect"]);
		expect(page.errors).toEqual([]);
	});

	it("mounts a component with no props, and returns its exports, which unmount takes", async () => {
		const { page, rootChildren } = await host(false);
		const layer = page.asBackground(() => mount(Titled));
		expect(typeof layer).toBe("object");
		await page.settle();
		expect(rootChildren()).toEqual([...PAGE, "page"]);
		page.asBackground(() => unmount(layer));
		await page.settle();
		expect(rootChildren()).toEqual(PAGE);
	});
});

describe("unmount", () => {
	it("takes a layer away before it returns, and returns nothing", async () => {
		const { page, log, rootChildren, open } = await host(false);
		const layer = await open("one");
		const returned = page.asBackground(() => unmount(layer));
		expect(returned).toBeUndefined();
		expect(log).toEqual(["destroyed one"]);
		await page.settle();
		expect(rootChildren()).toEqual(PAGE);
		expect(page.errors).toEqual([]);
	});

	it("takes each layer away, from a timer too, and leaves the page's elements as they were", async () => {
		const { page, log, handles, rootChildren, open, later } = await host();
		const drawn = page.engine.all(page.byClass("page"));
		await tap(page, page.byClass("open"));
		const layers = [await open("inbox", true, { target: handles["box"] }), await open("timer")];
		for (const layer of layers) await later(() => unmount(layer));
		page.asBackground(() => {
			unmount(handles["fromHandler"] as Instance);
			unmount(handles["fromEffect"] as Instance);
		});
		await page.settle();
		expect(rootChildren()).toEqual(PAGE);
		expect(page.engine.all(page.byClass("page"))).toEqual(drawn);
		expect(log).toEqual(
			expect.arrayContaining([
				"destroyed effect",
				"destroyed handler",
				"destroyed timer",
				"destroyed inbox",
			]),
		);
		expect(page.errors).toEqual([]);
	});

	it("closes two layers in either order", async () => {
		const { page, rootChildren, open } = await host(false);
		const close = async (layer: Instance) => {
			page.asBackground(() => unmount(layer));
			await page.settle();
		};
		const one = await open("one");
		const two = await open("two");
		expect(rootChildren()).toEqual([...PAGE, "layer one", "layer two"]);
		await close(one);
		expect(rootChildren()).toEqual([...PAGE, "layer two"]);
		await close(two);
		expect(rootChildren()).toEqual(PAGE);
		const three = await open("three");
		const four = await open("four");
		await close(four);
		expect(rootChildren()).toEqual([...PAGE, "layer three"]);
		await close(three);
		expect(rootChildren()).toEqual(PAGE);
		expect(page.errors).toEqual([]);
	});

	it("reports an error of a layer's teardown once, and still takes it away", async () => {
		const { page, rootChildren } = await host(false);
		const layer = page.asBackground(() => mount(TeardownThrows));
		await page.settle();
		expect(rootChildren()).toEqual([...PAGE, "root"]);
		const unhandled: unknown[] = [];
		const onUnhandled = (reason: unknown) => void unhandled.push(reason);
		process.on("unhandledRejection", onUnhandled);
		try {
			page.asBackground(() => unmount(layer));
			await page.settle();
			// A rejection nobody handled is told when the event loop turns.
			await new Promise((resolve) => setTimeout(resolve, 10));
		} finally {
			process.off("unhandledRejection", onUnhandled);
		}
		expect(page.errors.map(String)).toEqual(["Error: teardown failed"]);
		expect(unhandled).toEqual([]);
		expect(rootChildren()).toEqual(PAGE);
	});
});
