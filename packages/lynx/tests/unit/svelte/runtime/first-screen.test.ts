// A list's first screen, counted as the rows render: (10 + preload-buffer-count) × span-count rows,
// or initial-item-count, a full-span row taking a whole line; the rows up to initial-scroll-index
// too, to a cap; each list its own count, the innermost open counting; and no row a branch only
// one thread renders draws.

import { describe, expect, it } from "@rstest/core";

import { ThreadBranch } from "../../../../src/svelte/runtime/client-internals.ts";
import {
	endFirstScreens,
	FirstScreens,
	SCROLL_INDEX_CAP,
	startFirstScreens,
	startingScreens,
} from "../../../../src/svelte/runtime/first-screen.ts";
import type { ListAttributes } from "../../../../src/svelte/runtime/first-screen.ts";

/** Which of `rows` rows (each full-span or not) a list with `attributes` draws whole. */
function drawn(attributes: ListAttributes, rows: number | boolean[]): boolean[] {
	const screens = new FirstScreens();
	screens.open(attributes);
	const spans = typeof rows === "number" ? Array.from({ length: rows }, () => false) : rows;
	return spans.map((fullSpan) => screens.row(fullSpan));
}

const count = (rows: boolean[]): number => rows.filter(Boolean).length;

describe("a list's first screen", () => {
	it("is ten rows, and as many more as preload-buffer-count, times span-count", () => {
		expect(count(drawn({}, 40))).toBe(10);
		expect(count(drawn({ "preload-buffer-count": 5 }, 40))).toBe(15);
		expect(count(drawn({ "span-count": 3 }, 40))).toBe(30);
		expect(count(drawn({ "column-count": 2 }, 40))).toBe(20);
		expect(count(drawn({ "span-count": 2, "preload-buffer-count": 5 }, 40))).toBe(30);
	});

	it("is a prefix of the list", () => {
		expect(drawn({}, 12)).toEqual([...Array(10).fill(true), false, false]);
	});

	it("reads only numbers, as Lynx does, and none below what Lynx takes", () => {
		expect(count(drawn({ "span-count": "3", "preload-buffer-count": "5" }, 40))).toBe(10);
		expect(count(drawn({ "span-count": 0, "preload-buffer-count": -4 }, 40))).toBe(10);
		expect(count(drawn({ "span-count": 2.7 }, 40))).toBe(20);
	});

	it("is initial-item-count rows when the list says, none at 0, also written as text", () => {
		expect(count(drawn({ "initial-item-count": 3, "preload-buffer-count": 5 }, 40))).toBe(3);
		expect(count(drawn({ "initial-item-count": 0 }, 40))).toBe(0);
		expect(count(drawn({ "initial-item-count": "3" }, 40))).toBe(3);
		expect(count(drawn({ "initial-item-count": "012" }, 40))).toBe(12);
		expect(count(drawn({ "initial-item-count": null }, 40))).toBe(10);
	});

	it("is the default for an initial-item-count that is not a count, and says so", () => {
		for (const value of [-1, 2.5, "three", " 3", "-1", true, Number.NaN]) {
			const screens = new FirstScreens();
			screens.open({ "initial-item-count": value }, "src/Feed.svelte:3:0");
			const rows = Array.from({ length: 40 }, () => screens.row(false));
			expect(count(rows), String(value)).toBe(10);
			expect(screens.notes).toEqual([
				{
					code: "initial_item_count_not_a_count",
					value: typeof value === "string" ? JSON.stringify(value) : String(value),
					where: "src/Feed.svelte:3:0",
				},
			]);
		}
	});

	it("counts a full-span row as a whole line of span-count rows", () => {
		const rows = [true, ...Array<boolean>(30).fill(false)];
		expect(count(drawn({ "span-count": 3 }, rows))).toBe(1 + 27);
		expect(count(drawn({}, rows))).toBe(10);
	});

	it("runs up to initial-scroll-index and a screen past it", () => {
		expect(count(drawn({ "initial-scroll-index": 30 }, 60))).toBe(40);
		expect(count(drawn({ "initial-scroll-index": SCROLL_INDEX_CAP }, 200))).toBe(
			SCROLL_INDEX_CAP + 10,
		);
	});

	it("is only the first screen past the cap, and says so once", () => {
		const screens = new FirstScreens();
		screens.open({ "initial-scroll-index": SCROLL_INDEX_CAP + 1 }, "src/Feed.svelte:3:0");
		const rows = Array.from({ length: 200 }, () => screens.row(false));
		expect(count(rows)).toBe(10);
		expect(screens.notes).toEqual([
			{
				code: "initial_scroll_index_past_first_screen",
				index: SCROLL_INDEX_CAP + 1,
				where: "src/Feed.svelte:3:0",
			},
		]);
	});

	it("says nothing of a list that counts no row: one with no deferred row", () => {
		const screens = new FirstScreens();
		screens.open({ "initial-scroll-index": 150, "initial-item-count": "three" });
		screens.close();
		expect(screens.notes).toEqual([]);
	});

	it("is counted by the list open innermost, each list its own", () => {
		const screens = new FirstScreens();
		screens.open({ "initial-item-count": 2 });
		expect(screens.row(false)).toBe(true);
		screens.open({ "initial-item-count": 1 });
		expect([screens.row(false), screens.row(false)]).toEqual([true, false]);
		screens.close();
		expect([screens.row(false), screens.row(false)]).toEqual([true, false]);
		screens.close();
		// Outside every list, a row is not drawn whole.
		expect(screens.row(false)).toBe(false);
	});

	it("draws no row of a branch only one thread renders, and counts none there", () => {
		const screens = new FirstScreens();
		screens.open({ "initial-item-count": 1 });
		let inBranch: boolean | undefined;
		ThreadBranch(undefined, {
			thread: "background",
			render: () => {
				inBranch = screens.row(false);
			},
		});
		expect(inBranch).toBe(false);
		expect(screens.row(false)).toBe(true);
	});
});

describe("the background's count", () => {
	it("is there only while the page starts", () => {
		expect(startingScreens()).toBeUndefined();
		startFirstScreens();
		startingScreens()!.open({ "initial-scroll-index": 500 });
		startingScreens()!.row(false);
		expect(endFirstScreens()).toEqual([
			{ code: "initial_scroll_index_past_first_screen", index: 500, where: undefined },
		]);
		expect(startingScreens()).toBeUndefined();
		expect(endFirstScreens()).toEqual([]);
	});
});
