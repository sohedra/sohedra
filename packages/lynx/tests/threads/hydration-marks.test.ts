// The branch each of Svelte's blocks took, as the background's first patch carries it: through the
// splitter, a parent made while its children are written, components, a list's cells, a list in a
// cell, deferred rows and texts in a `<text>`. Read as the main thread receives it, the
// background's tree lines up with the first frame's block for block, and hydration pairs by it.

import { describe, expect, it } from "@rstest/core";

import InText from "../fixtures/threads/marks/InText.svelte";
import drawInText from "../fixtures/threads/marks/InText.svelte?first-frame";
import Marks from "../fixtures/threads/marks/Marks.svelte";
import drawMarks from "../fixtures/threads/marks/Marks.svelte?first-frame";
import { align, builtEntries, drawnEntries } from "./generated/entries.ts";
import type { FirstFrameCopy } from "./svelte-page.ts";
import { startSveltePage } from "./svelte-page.ts";

/** Starts `App`, drawn from `drawn` and rendered from `built`, and lines the two trees up. */
async function lineUp(
	App: Parameters<typeof startSveltePage>[0],
	draw: FirstFrameCopy,
	{ drawn, built, taps = [] }: { drawn: object; built: object; taps?: string[] },
) {
	const log: unknown[] = [];
	const page = startSveltePage(App, {
		props: () => ({ ...built, log }),
		firstFrame: { draw, props: { ...drawn, log } },
	});
	const root = page.runtime.page.frame!.root;
	for (const token of taps) page.engine.dispatch(page.byClass(token), { type: "tap" });
	await page.settle();
	const read = builtEntries(page.patches[0]!);
	let next = 10_000_000;
	const alignment = align(
		read.entries,
		drawnEntries(root.children, () => next++),
	);
	return { page, log, read, alignment, root };
}

describe("the branch marks", () => {
	it("line the background's tree up with the first frame's, for the same data", async () => {
		const data = { user: "ada", flag: true };
		const { page, read, alignment } = await lineUp(Marks, drawMarks, { drawn: data, built: data });
		expect(read.unreadable).toBe(0);
		expect(alignment.misaligned).toEqual([]);
		expect(alignment.otherBlocks).toBe(0);
		expect(alignment.sameBlocks).toBeGreaterThan(20);
		expect(page.errors).toEqual([]);
	});

	it("tell each block that took another branch apart, for other data", async () => {
		const { page, read, alignment } = await lineUp(Marks, drawMarks, {
			drawn: { user: null, flag: false },
			built: { user: "ada", flag: true },
		});
		expect(read.unreadable).toBe(0);
		expect(alignment.misaligned).toEqual([]);
		expect(alignment.otherBlocks).toBeGreaterThan(5);
		expect(page.errors).toEqual([]);
		expect(page.messages.filter((message) => message.t === "rewrite")).toEqual([]);
	});

	it("end a list in a cell with the block that closes its count, on both threads", async () => {
		const data = { user: "ada", flag: true };
		const { read, root } = await lineUp(Marks, drawMarks, { drawn: data, built: data });
		let next = 20_000_000;
		for (const entries of [read.entries, drawnEntries(root.children, () => next++)]) {
			const pageList = entries.find((entry) => entry.kind === "element" && entry.tag === "list");
			const cell = pageList?.kind === "element" ? pageList.cells?.[0] : undefined;
			const inner = cell === "none" ? undefined : cell?.find((entry) => entry.kind === "element");
			expect(inner?.children.at(-1)).toEqual({ kind: "block", key: -1, children: [] });
		}
	});

	it("say a block's place among texts in a <text>", async () => {
		const { read, alignment, page } = await lineUp(InText, drawInText, {
			drawn: { b: false },
			built: { b: false },
		});
		expect(read.unreadable).toBe(0);
		expect(alignment.misaligned).toEqual([]);
		expect(page.errors).toEqual([]);
	});

	it("let early taps run their own handlers, at the root, three components deep and in a cell", async () => {
		const data = { user: "ada", flag: true };
		const { log, page } = await lineUp(Marks, drawMarks, {
			drawn: data,
			built: data,
			taps: ["root-user", "fixed", "deep-3"],
		});
		expect(log).toEqual(["root-user", "fixed", "deep 3"]);
		expect(page.warnings).toEqual([]);
	});

	it("drop an early tap in a block that took another branch, and keep its neighbors'", async () => {
		const { log, page } = await lineUp(Marks, drawMarks, {
			drawn: { user: null, flag: true },
			built: { user: "ada", flag: true },
			taps: ["root-guest", "fixed", "deep-3"],
		});
		expect(log).toEqual(["fixed", "deep 3"]);
		expect(page.warnings).toEqual([expect.objectContaining({ code: "first_frame_event_dropped" })]);
	});
});
