// A patch that adds a row to a list inside a list's row and reads a computed style, where Lynx asks
// for the new row inside the list's update, as iOS does. Making that row settles its function refs,
// and must not run the patch's reads before the patch is flushed: they wait for its flush.

import { expect, it } from "@rstest/core";
import { flushSync } from "svelte";

import type { ElementNode } from "../../../src/background/renderer/element.ts";
import NestedComputed from "../../fixtures/threads/NestedComputed.svelte";
import { startSveltePage } from "../svelte-page.ts";

async function nested() {
	const handles: Record<string, unknown> = {};
	const page = startSveltePage(NestedComputed, { props: () => ({ handles }) });
	await page.settle();
	page.engine.list(page.byClass("outer")).show(0);
	await page.settle();
	const groups = handles["groups"] as { id: number; items: string[] }[];
	const box = handles["box"] as ElementNode;
	/** Adds a row to the inner list and reads the box's opacity, set in the same patch. */
	const change = () =>
		page.asBackground(() => {
			groups[0]!.items.push("two");
			flushSync();
			box.setStyleProperty("opacity", "0.7");
			return box.getComputedStyleProperty("opacity");
		});
	return { page, change };
}

it("reads a computed style after the patch's flush, though Lynx made a row inside its update", async () => {
	const { page, change } = await nested();
	const inner = page.engine.list(page.byClass("inner-1"));
	inner.show(0);
	let asked = 0;
	inner.onUpdate = () => {
		asked++;
		inner.show(1);
	};
	const answer = change();
	await page.settle();
	inner.onUpdate = undefined;
	expect(asked).toBe(1);
	expect(await answer).toBe("0.7");
	expect(page.errors).toEqual([]);
});

it("reads it so when Lynx asks for no row in the update", async () => {
	const { page, change } = await nested();
	const answer = change();
	await page.settle();
	expect(await answer).toBe("0.7");
});
