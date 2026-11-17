// What a Lynx `<list>` is told when its items change: removals at their old indexes, then
// insertions and updates at their new positions. Both threads write it, so it is checked here on
// its own, up to 1,000 items, with the number of actions each change costs held to a budget.

import { describe, expect, it } from "@rstest/core";

import { LIST_ITEM_INFO, listUpdateInfo, Order, unmoved } from "../../../src/wire/index.ts";
import type { ListItemInfo, ListUpdateInfo } from "../../../src/wire/index.ts";

/** Every item's info: its key, as `item-key` carries it. */
const infosOf = (ids: number[]): Map<number, ListItemInfo> =>
	new Map(ids.map((id) => [id, { "item-key": `k${id}` }]));

const range = (from: number, to: number): number[] =>
	Array.from({ length: to - from }, (_, index) => from + index);

/** What the list holds after it applies `info` to `committed`, as Lynx does: by key. */
function applied(committed: number[], info: ListUpdateInfo): string[] {
	const keys = committed.map((id) => `k${id}`);
	for (const index of [...info.removeAction].sort((a, b) => b - a)) keys.splice(index, 1);
	for (const insertion of [...info.insertAction].sort((a, b) => a.position - b.position))
		keys.splice(insertion.position, 0, String(insertion["item-key"]));
	return keys;
}

const count = (info: ListUpdateInfo): number =>
	info.insertAction.length + info.removeAction.length + info.updateAction.length;

const N = 1000;
const ALL = range(1, N + 1);
const middle = N / 2;

// [the change, the items before, after, the items whose info changed, the actions it may cost]
const CHANGES: [string, number[], number[], number[], number][] = [
	["the first render", [], ALL, [], N],
	["an empty list that stays empty", [], [], [], 0],
	["a list emptied", ALL, [], [], N],
	["nothing changed", ALL, ALL, [], 0],
	["an item appended", ALL, [...ALL, N + 1], [], 1],
	["an item prepended", ALL, [0, ...ALL], [], 1],
	[
		"an item inserted in the middle",
		ALL,
		[...ALL.slice(0, middle), N + 1, ...ALL.slice(middle)],
		[],
		1,
	],
	[
		"a hundred items inserted",
		ALL,
		[...ALL.slice(0, middle), ...range(N + 1, N + 101), ...ALL.slice(middle)],
		[],
		100,
	],
	["an item removed", ALL, ALL.filter((id) => id !== middle), [], 1],
	["every other item removed", ALL, ALL.filter((id) => id % 2 === 0), [], N / 2],
	["the last item moved to the start", ALL, [N, ...ALL.slice(0, -1)], [], 2],
	["the first item moved to the end", ALL, [...ALL.slice(1), 1], [], 2],
	["two neighbors swapped", ALL, [2, 1, ...ALL.slice(2)], [], 2],
	["ten items updated in place", ALL, ALL, range(1, 11), 10],
	["every item updated in place", ALL, ALL, ALL, N],
	["a moved item that also changed", ALL, [N, ...ALL.slice(0, -1)], [N], 2],
	["the list reversed", ALL, [...ALL].reverse(), [], 2 * (N - 1)],
	["the list replaced", ALL, range(N + 1, 2 * N + 1), [], 2 * N],
];

describe("listUpdateInfo", () => {
	it.each(CHANGES)(
		"%s: the list ends as the items, within its budget",
		(_, before, after, changed, budget) => {
			const infos = infosOf([...before, ...after]);
			const info = listUpdateInfo({
				committed: before,
				items: after,
				infos,
				changed: new Set(changed),
			});
			expect(applied(before, info)).toEqual(after.map((id) => `k${id}`));
			expect(count(info)).toBeLessThanOrEqual(budget);
		},
	);

	it("gives removals as old indexes, and insertions with their key and type", () => {
		const info = listUpdateInfo({
			committed: [1, 2, 3],
			items: [1, 4, 3],
			infos: new Map([
				[4, { "item-key": "d", "reuse-identifier": "card" }],
				[3, { "item-key": "c" }],
			]),
			changed: new Set([3]),
		});
		expect(info).toEqual({
			insertAction: [{ position: 1, type: "card", "item-key": "d", "reuse-identifier": "card" }],
			removeAction: [1],
			updateAction: [{ from: 2, to: 2, flush: false, type: "list-item", "item-key": "c" }],
		});
	});

	it("types an item with no info as a list item", () => {
		const info = listUpdateInfo({
			committed: [],
			items: [7],
			infos: new Map(),
			changed: new Set(),
		});
		expect(info.insertAction).toEqual([{ position: 0, type: "list-item" }]);
	});

	it("names only the attributes the list itself reads as an item's info", () => {
		expect([...LIST_ITEM_INFO].sort()).toEqual([
			"estimated-height",
			"estimated-height-px",
			"estimated-main-axis-size-px",
			"full-span",
			"item-key",
			"recyclable",
			"reuse-identifier",
			"sticky-bottom",
			"sticky-top",
		]);
	});
});

describe("unmoved", () => {
	it("keeps the longest run in unchanged order", () => {
		expect(new Set(unmoved([1, 2, 3], [1, 2, 3]))).toEqual(new Set([1, 2, 3]));
		expect(new Set(unmoved([1, 2, 3], [3, 1, 2]))).toEqual(new Set([1, 2]));
		expect(unmoved([1, 2, 3, 4], [4, 3, 2, 1]).size).toBe(1);
		expect(unmoved([1, 2], []).size).toBe(0);
		expect(unmoved([], [1]).size).toBe(0);
	});

	it("keeps all but the moved item of 1,000", () => {
		const kept = unmoved(ALL, [...ALL.slice(0, 10), N, ...ALL.slice(10, -1)]);
		expect(kept.size).toBe(N - 1);
		expect(kept.has(N)).toBe(false);
	});
});

describe("Order", () => {
	it("inserts before an anchor, and appends for 0 or an anchor it does not hold; ids are positive", () => {
		const order = new Order();
		order.insert(2, 0);
		order.insert(4, 0);
		order.insert(3, 4);
		order.insert(1, 2);
		order.insert(5, 99);
		expect(order.toArray()).toEqual([1, 2, 3, 4, 5]);
	});

	it("deletes from anywhere, and ignores an id it does not hold", () => {
		const order = new Order();
		for (const id of [1, 2, 3, 4]) order.insert(id, 0);
		order.delete(1);
		order.delete(3);
		order.delete(4);
		order.delete(9);
		expect(order.toArray()).toEqual([2]);
		order.delete(2);
		expect(order.toArray()).toEqual([]);
		order.insert(5, 0);
		expect(order.toArray()).toEqual([5]);
	});

	it("holds 1,000 ids in order", () => {
		const order = new Order();
		for (const id of ALL) order.insert(id, 0);
		for (const id of ALL.filter((id) => id % 2 === 1)) order.delete(id);
		order.insert(1, 2);
		expect(order.toArray()).toEqual([1, ...ALL.filter((id) => id % 2 === 0)]);
	});
});
