// The splitter holds back the cells that wait to be asked for: a deferred row whose contents have
// not rendered, or whose text the main thread let go of. Nothing of such a cell is sent; its list
// still hears of it, with its info.

import { describe, expect, it } from "@rstest/core";

import { createSplitter } from "../../../src/background/split.ts";
import { encodeCell, OpCode as O, ROOT_ID } from "../../../src/wire/index.ts";
import type { Op } from "../../../src/wire/index.ts";

const LIST: Op[] = [
	[O.Create, 2, "list"],
	[O.Insert, ROOT_ID, 2, 0],
];
const row = (id: number, key: string): Op[] => [
	[O.Create, id, "list-item"],
	[O.SetAttr, id, "item-key", key],
	[O.Insert, 2, id, 0],
];

describe("a cell held back", () => {
	it("sends none of its ops, and its list hears of it with its info", () => {
		const split = createSplitter(encodeCell, (id) => id === 10);
		const items = split.split([...LIST, ...row(10, "a"), ...row(20, "b")]);
		expect(items.filter((item) => item[0] === "cell").map((item) => item[1])).toEqual([20]);
		const update = items.flatMap((item) => (item[0] === "ops" ? item[1] : [])).at(-1)!;
		expect(update[0]).toBe(O.ListUpdate);
		expect(update[3]).toEqual([10, 20]);
		expect(split.holds(10)).toBe(true);
		// What is made in it, and changes of it, are not sent; a change of its info still is.
		const later = split.split([
			[O.Create, 11, "text"],
			[O.Insert, 10, 11, 0],
			[O.SetAttr, 10, "item-key", "c"],
		]);
		expect(later.filter((item) => item[0] === "cell")).toEqual([]);
		expect(JSON.stringify(later)).toContain('"item-key":"c"');
	});

	it("is sent again once written whole, and held again when the main thread lets go of it", () => {
		const split = createSplitter(encodeCell, (id) => id === 10);
		split.split([...LIST, ...row(10, "a")]);
		split.written(10);
		expect(split.holds(10)).toBe(false);
		expect(split.split([[O.SetAttr, 10, "class", "x"]])).toEqual([
			["cell", 10, encodeCell([[O.SetAttr, 10, "class", "x"]])],
		]);
		split.hold(10);
		expect(split.split([[O.SetAttr, 10, "class", "y"]])).toEqual([]);
	});

	it("is forgotten when it is released", () => {
		const split = createSplitter(encodeCell, (id) => id === 10);
		split.split([...LIST, ...row(10, "a")]);
		split.split([
			[O.Remove, 2, 10],
			[O.Release, 10],
		]);
		expect(split.holds(10)).toBe(false);
	});

	it("is only a cell: holding another element does nothing", () => {
		const split = createSplitter(encodeCell);
		split.split([...LIST, ...row(10, "a"), [O.Create, 11, "view"], [O.Insert, 10, 11, 0]]);
		split.hold(11);
		expect(split.holds(11)).toBe(false);
	});
});
