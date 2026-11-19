// A list in an `{#if background}` branch whose other branch draws it with other attributes
// (`{#if background}<list>…{:else}<list>…<list-item class="drawn">…{/if}`), with a cell Lynx asked
// for before the background's first patch. The branches differ only in attributes, so hydration
// adopts the list and the cell, and writes the background's attributes over the frame's, as it
// does for any element in a branch: nothing is reported, and the page is not made again.

import { describe, expect, it } from "@rstest/core";

import type { LynxElement } from "../../../src/testing/index.ts";
import FrameBranchList from "../../fixtures/threads/FrameBranchList.svelte";
import drawFrameBranchList from "../../fixtures/threads/FrameBranchList.svelte?first-frame";
import { backgroundTree, engineTree, expectSameTree } from "../generated/trees.ts";
import { startSveltePage } from "../svelte-page.ts";

describe("a list in a branch that differs only in attributes", () => {
	it("keeps a cell Lynx asked for early, with the background's attributes", async () => {
		const page = startSveltePage(FrameBranchList, { firstFrame: { draw: drawFrameBranchList } });
		const list = () => page.engine.list(page.byClass("list"));
		const cell = list().show(0);
		await page.settle();
		expect(page.errors).toEqual([]);
		expect(page.messages.filter((message) => message.t === "rewrite")).toEqual([]);
		expect(list().show(0)).toBe(cell);
		expect(page.engine.state(cell).classes).toBe("row");
		expect(page.engine.state(cell.firstChild as LynxElement).classes).toBe("label");
		expectSameTree(engineTree(page.engine), backgroundTree());
	});
});
