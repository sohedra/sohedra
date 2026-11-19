// A page that ends: what reaches either thread after it is let go of without a word, every step of
// the end runs though one throws, and an error of the app's teardown is reported once. A node of
// the ended page sends nothing and throws nothing; what would answer rejects, saying the page is
// gone.

import { setFlagsFromString } from "node:v8";
import { runInNewContext } from "node:vm";

import { describe, expect, it, rs } from "@rstest/core";

import type { ElementNode } from "../../../src/background/renderer/element.ts";
import { pageRenderer } from "../../../src/background/renderer/page-renderer.ts";
import { mainThreadRef, mount } from "../../../src/background/root-entry.ts";
import { readGlobal } from "../../../src/testing/globals.ts";
import { PATCH_METHOD } from "../../../src/wire/index.ts";
import Counter from "../../fixtures/threads/Counter.svelte";
import ElementMethods from "../../fixtures/threads/ElementMethods.svelte";
import Layer from "../../fixtures/threads/page/Layer.svelte";
import TeardownThrows from "../../fixtures/threads/page/TeardownThrows.svelte";
import { startSveltePage } from "../svelte-page.ts";
import type { SveltePage } from "../svelte-page.ts";

setFlagsFromString("--expose-gc");
// Boundary: a context made after the flag has V8's `gc`.
const gc = runInNewContext("gc") as () => void;

/** Collects what nothing refers to: a `WeakRef`'s target stays until its task ends. */
async function collect(): Promise<void> {
	for (let round = 0; round < 3; round++) {
		await new Promise((resolve) => setTimeout(resolve, 0));
		gc();
	}
}

/** Ends the background's page alone, as the engine's call does; the main thread's goes on. */
function endBackground(page: SveltePage): void {
	page.asBackground(() => (page.app["callDestroyLifetimeFun"] as () => void)());
}

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

describe("what reaches a thread after its page ended", () => {
	it("is let go of on the main thread: a patch that comes late", async () => {
		const page = startSveltePage(Counter);
		await page.settle();
		const stale = JSON.stringify(page.patches[0]);
		page.destroy();
		await page.settle();
		const late = (() => {
			// A String object, not text: the collector can tell whether it is still held.
			const data = new String(stale);
			const patch = readGlobal(PATCH_METHOD) as (params: { data: unknown }) => void;
			page.asMainThread(() => patch({ data }));
			return new WeakRef(data);
		})();
		await collect();
		expect(late.deref()).toBeUndefined();
		expect(page.errors).toEqual([]);
	});

	it("is dropped on the background: an event", async () => {
		const page = startSveltePage(Counter);
		await page.settle();
		endBackground(page);
		await page.settle();
		page.engine.dispatch(page.byClass("button"), { type: "tap" });
		await page.settle();
		expect(page.engine.texts()[0]).toBe("Taps: 0 (even)");
		expect(page.errors).toEqual([]);
	});

	it("is dropped on the background: the main thread's answer to a UI call", async () => {
		const handles: Record<string, unknown> = {};
		const page = startSveltePage(ElementMethods, { props: { handles } });
		await page.settle();
		const replies = holdMessages(page);
		const asked = page.asBackground(() =>
			(handles["box"] as ElementNode).invoke("boundingClientRect"),
		);
		asked.catch(() => {});
		await page.settle();
		expect(replies.held).toHaveLength(1);
		endBackground(page);
		replies.deliver();
		await page.settle();
		await expect(asked).rejects.toMatchObject({ code: "page_is_gone" });
		expect(page.errors).toEqual([]);
	});
});

describe("a node of a page that ended", () => {
	it("sends nothing and throws nothing; what would answer rejects", async () => {
		const handles: Record<string, ElementNode> = {};
		const page = startSveltePage(ElementMethods, { props: { handles } });
		await page.settle();
		const node = handles["box"]!;
		page.destroy();
		await page.settle();
		const patches = page.patches.length;
		const messages = page.messages.length;
		const answers = page.asBackground(() => {
			node.setStyleProperty("opacity", "0.5");
			node.setStyleProperties({ opacity: "0.5", width: null });
			node.setAttribute("data-late", "yes");
			const animation = node.animate([{ opacity: 0 }, { opacity: 1 }], 100);
			animation.play();
			animation.pause();
			animation.cancel();
			animation.finish();
			return [
				node.invoke("boundingClientRect"),
				node.getComputedStyleProperty("opacity"),
				node.querySelector(".x"),
				node.querySelectorAll(".x"),
			];
		});
		for (const answer of answers)
			await expect(answer).rejects.toMatchObject({ code: "page_is_gone" });
		await page.settle();
		expect(page.patches).toHaveLength(patches);
		expect(page.messages).toHaveLength(messages);
		expect(page.errors).toEqual([]);
	});

	it("is a main-thread ref read after the end, which sends nothing and throws nothing", async () => {
		const page = startSveltePage(Counter);
		await page.settle();
		const ref = page.asBackground(() => mainThreadRef(7));
		page.destroy();
		await page.settle();
		const patches = page.patches.length;
		expect(page.asBackground(() => ref.current)).toBe(7);
		await page.settle();
		expect(page.patches).toHaveLength(patches);
		expect(page.errors).toEqual([]);
	});
});

describe("the page's end", () => {
	it("runs every step though one throws, and reports the first error once", async () => {
		const page = startSveltePage(Counter);
		await page.settle();
		const retire = rs.spyOn(pageRenderer, "retire").mockImplementation(() => {
			throw new Error("retire failed");
		});
		try {
			page.destroy();
			await page.settle();
		} finally {
			retire.mockRestore();
		}
		expect(page.errors.map(String)).toEqual(["Error: retire failed"]);
		// A step after it: the page's layers are closed.
		expect(() =>
			page.asBackground(() => mount(Layer, { props: { label: "late", log: [] } })),
		).toThrow(/no page running/);
	});

	it("reports an error of the app's teardown once, and leaves no unhandled rejection", async () => {
		const page = startSveltePage(TeardownThrows);
		await page.settle();
		const unhandled: unknown[] = [];
		const onUnhandled = (reason: unknown) => void unhandled.push(reason);
		process.on("unhandledRejection", onUnhandled);
		try {
			page.destroy();
			await page.settle();
			await new Promise((resolve) => setTimeout(resolve, 10));
		} finally {
			process.off("unhandledRejection", onUnhandled);
		}
		expect(page.errors.map(String)).toEqual(["Error: teardown failed"]);
		expect(unhandled).toEqual([]);
	});
});
