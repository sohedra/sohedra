// A list in an `{#if background}` branch whose other branch draws it with other attributes
// (`{#if background}<list>…{:else}<list>…<list-item class="drawn">…{/if}`), with a cell Lynx asked
// for before the background's first patch. The threads took other branches, so hydration makes the
// list again in place, with its cells, and lets go of the cell Lynx asked for: nothing is reported,
// and the page is not written again.

import { describe, expect, it } from "@rstest/core";

import type { LynxElement } from "../../../src/testing/index.ts";
import FrameBranchList from "../../fixtures/threads/FrameBranchList.svelte";
import drawFrameBranchList from "../../fixtures/threads/FrameBranchList.svelte?first-frame";
import { backgroundTree, engineTree, expectSameTree } from "../generated/trees.ts";
import { startSveltePage } from "../svelte-page.ts";

describe("a list in a branch that differs only in attributes", () => {
	it("is made again in place, with the background's attributes", async () => {
		const page = startSveltePage(FrameBranchList, { firstFrame: { draw: drawFrameBranchList } });
		const list = () => page.engine.list(page.byClass("list"));
		const cell = list().show(0);
		await page.settle();
		expect(page.errors).toEqual([]);
		expect(page.messages.filter((message) => message.t === "rewrite")).toEqual([]);
		const made = list().show(0);
		expect(made).not.toBe(cell);
		expect(page.engine.state(made).classes).toBe("row");
		expect(page.engine.state(made.firstChild as LynxElement).classes).toBe("label");
		expectSameTree(engineTree(page.engine), backgroundTree());
	});
});
