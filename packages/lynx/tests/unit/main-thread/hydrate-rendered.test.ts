// The page as the background rendered it, read from the first patch's rendered items: the tree
// hydration matches the first frame against, and the ops that make a part of it again.

import { describe, expect, it } from "@rstest/core";

import {
	entriesOf,
	NotATree,
	opsOf,
	readCell,
	readRendered,
} from "../../../src/main-thread/hydrate/rendered.ts";
import {
	encodeCall,
	encodeCell,
	listUpdateInfo,
	OpCode,
	ROOT_ID,
} from "../../../src/wire/index.ts";
import type { Op, PatchItem } from "../../../src/wire/index.ts";

const VIEW: Op[] = [
	[OpCode.Create, 2, "view"],
	[OpCode.SetAttr, 2, "class", "a"],
	[OpCode.SetAttr, 2, "hidden", "x"],
	[OpCode.SetAttr, 2, "hidden", null],
	[OpCode.SetEvent, 2, "bindEvent", "tap", 1],
	[OpCode.SetStyles, 2, { opacity: 1 }],
	[OpCode.Animate, 2, [0, "fade"]],
	[OpCode.Create, 3, "text"],
	[OpCode.CreateText, 4, "a"],
	[OpCode.SetText, 4, "b"],
	[OpCode.Insert, 3, 4, 0],
	[OpCode.Create, 5, "text"],
	[OpCode.Insert, 2, 5, 0],
	[OpCode.Insert, 2, 3, 5],
	[OpCode.Create, 6, "view"],
	[OpCode.Insert, 2, 6, 0],
	[OpCode.Remove, 2, 6],
	[OpCode.Release, 6],
	[OpCode.Insert, ROOT_ID, 2, 0],
];

describe("the rendered page", () => {
	it("is the tree the rendered items make, as they leave it", () => {
		const rendered = readRendered(
			[
				["ops", VIEW],
				["ops", [[OpCode.SetText, 4, "after"]]],
			],
			1,
		);
		const view = rendered.nodes.get(2)!;
		expect(view.attrs).toEqual(new Map([["class", "a"]]));
		expect(view.ops.map((op) => op[0])).toEqual([
			OpCode.SetEvent,
			OpCode.SetStyles,
			OpCode.Animate,
		]);
		expect(view.children).toEqual([3, 5]);
		expect(view.parent).toBe(ROOT_ID);
		expect(rendered.nodes.get(4)).toMatchObject({ tag: "#text", text: "b", parent: 3 });
		expect(rendered.nodes.has(6)).toBe(false);
		expect(rendered.nodes.get(ROOT_ID)!.children).toEqual([2]);
	});

	it("keeps the cells' texts and the calls apart", () => {
		const call: PatchItem = ["call", 1, 2, encodeCall(["invoke", "scrollTo", {}])];
		const cell = encodeCell([
			[OpCode.Create, 7, "list-item"],
			[OpCode.SetAttr, 7, "item-key", "k"],
		]);
		const update: Op = [
			OpCode.ListUpdate,
			2,
			listUpdateInfo({
				committed: [],
				items: [7],
				infos: new Map([[7, { "item-key": "k" }]]),
				changed: new Set(),
			}),
			[7],
			[7],
			[],
		];
		const rendered = readRendered(
			[
				[
					"ops",
					[
						[OpCode.Create, 2, "list"],
						[OpCode.Insert, ROOT_ID, 2, 0],
					],
				],
				["cell", 7, cell],
				call,
				["ops", [update]],
			],
			4,
		);
		expect(rendered.calls).toEqual([call]);
		expect(rendered.nodes.get(2)!.list).toMatchObject({ items: [7], keys: ["k"] });
		expect(readCell(rendered, 7)?.attrs).toEqual(new Map([["item-key", "k"]]));
		expect(readCell(rendered, 8)).toBeUndefined();
		expect(opsOf(rendered, 2)).toEqual([[OpCode.Create, 2, "list"], update]);
	});

	it("makes a part again with the ops it was made with", () => {
		const rendered = readRendered([["ops", VIEW]], 1);
		expect(opsOf(rendered, 2)).toEqual([
			[OpCode.Create, 2, "view"],
			[OpCode.SetAttr, 2, "class", "a"],
			[OpCode.SetEvent, 2, "bindEvent", "tap", 1],
			[OpCode.SetStyles, 2, { opacity: 1 }],
			[OpCode.Animate, 2, [0, "fade"]],
			[OpCode.Create, 3, "text"],
			[OpCode.CreateText, 4, "a"],
			[OpCode.Insert, 3, 4, 0],
			[OpCode.Insert, 2, 3, 0],
			[OpCode.Create, 5, "text"],
			[OpCode.Insert, 2, 5, 0],
		]);
	});

	it.each([
		["an op on an element never made", [["ops", [[OpCode.SetAttr, 9, "class", "a"]]]]],
		["an insert into an element never made", [["ops", [[OpCode.Insert, 9, 2, 0]]]]],
		["an item that is no part of a page", [["rewrite", ROOT_ID]]],
	] as [string, PatchItem[]][])("is no tree with %s", (_, items) => {
		expect(() => readRendered(items, items.length)).toThrow(NotATree);
	});

	describe("branch marks", () => {
		const page = (marks: Op[], more: Op[] = []) =>
			readRendered(
				[
					[
						"ops",
						[
							[OpCode.Create, 2, "view"],
							...[3, 4, 5].flatMap((id): Op[] => [
								[OpCode.Create, id, "text"],
								[OpCode.Insert, 2, id, 0],
							]),
							...marks,
							...more,
							[OpCode.Insert, ROOT_ID, 2, 0],
						],
					],
				],
				1,
			).nodes.get(2)!;

		it("fold the blocks into the children, an inner block one entry of the outer", () => {
			const view = page([
				[OpCode.Branch, 2, 1, 1, 2],
				[OpCode.Branch, 2, 0, 1, 2],
				[OpCode.Branch, 2, -1, 0, 3],
			]);
			expect(view.children).toEqual([3, 4, 5]);
			expect(entriesOf(view)).toEqual([
				3,
				{ key: 0, entries: [{ key: 1, entries: [4] }] },
				5,
				{ key: -1, entries: [] },
			]);
		});

		it("are the children as they are where there are none", () => {
			expect(entriesOf(page([]))).toEqual([3, 4, 5]);
		});

		it.each([
			[
				"out of order",
				[
					[OpCode.Branch, 2, 0, 1, 2],
					[OpCode.Branch, 2, 0, 1, 1],
				],
			],
			["past the children", [[OpCode.Branch, 2, 0, 1, 4]]],
			["holding more than came before", [[OpCode.Branch, 2, 0, 3, 2]]],
			["unreadable on purpose", [[OpCode.Branch, 2, 0, 0, -1]]],
		] as [string, Op[]][])("cannot be read when a mark is %s", (_, marks) => {
			expect(entriesOf(page(marks))).toBeNull();
		});

		it("cannot be read once a child was taken out or put anywhere but last", () => {
			expect(entriesOf(page([[OpCode.Branch, 2, 0, 1, 1]], [[OpCode.Remove, 2, 5]]))).toBeNull();
			expect(
				entriesOf(
					page(
						[[OpCode.Branch, 2, 0, 1, 1]],
						[
							[OpCode.Create, 6, "text"],
							[OpCode.Insert, 2, 6, 3],
						],
					),
				),
			).toBeNull();
		});

		it("are not made again with the part they are in", () => {
			const rendered = readRendered(
				[
					[
						"ops",
						[
							[OpCode.Create, 2, "view"],
							[OpCode.Branch, 2, -1, 0, 0],
							[OpCode.Insert, ROOT_ID, 2, 0],
						],
					],
				],
				1,
			);
			expect(opsOf(rendered, 2)).toEqual([[OpCode.Create, 2, "view"]]);
		});
	});
});
