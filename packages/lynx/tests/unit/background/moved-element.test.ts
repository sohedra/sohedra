// A node made in a list cell travels with that cell, which the main thread may never open. Moved
// out of it, it is made again in its new place: the page's ops never name an element that only a
// cell made.

import { describe, expect, it } from "@rstest/core";

import { createSplitter } from "../../../src/background/split.ts";
import { encodeCell, OpCode } from "../../../src/wire/index.ts";
import type { Op } from "../../../src/wire/index.ts";
import { rendererFixture } from "./renderer-fixture.ts";

/** The ids an item's ops make and the ids they name. */
function idsOf(ops: Op[]): { made: number[]; named: number[] } {
	const made: number[] = [];
	const named: number[] = [];
	for (const op of ops) {
		if (op[0] === OpCode.Create || op[0] === OpCode.CreateText) made.push(op[1]);
		else if (op[0] === OpCode.Insert) named.push(op[1], op[2], ...(op[3] === 0 ? [] : [op[3]]));
		else if (op[0] !== OpCode.ListUpdate) named.push(op[1]);
	}
	return { made, named };
}

describe("a node moved out of a list cell", () => {
	it("is made again on the page, so the page's ops name only elements the page made", () => {
		const { renderer, root, element, ops } = rendererFixture();
		const splitter = createSplitter(encodeCell);
		const list = element("list");
		const cell = element("list-item", list);
		const moving = element("view", cell);
		renderer.setAttribute(moving, "class", "moving");
		element("text", moving);
		splitter.split(ops());

		renderer.insert(root, moving, null);
		const items = splitter.split(ops());
		const page = items.flatMap((item) => (item[0] === "ops" ? item[1] : []));
		const { made, named } = idsOf(page);
		// Everything the page names is the page's own: the root, the list, and what it made now.
		const known = new Set([1, list.lynxId, ...made]);
		expect(named.filter((id) => !known.has(id))).toEqual([]);
		expect(page).toContainEqual([OpCode.SetAttr, moving.lynxId, "class", "moving"]);
		expect(page).toContainEqual([OpCode.Insert, 1, moving.lynxId, 0]);
		// The old element goes with its cell.
		expect(items.filter((item) => item[0] === "cell").length).toBe(1);
	});

	it("keeps its handlers: the same handler id is bound on the new element", () => {
		const { renderer, root, element, ops } = rendererFixture();
		const list = element("list");
		const cell = element("list-item", list);
		const moving = element("view", cell);
		moving.addEventListener("tap", () => {});
		ops();
		renderer.insert(root, moving, null);
		expect(ops()).toContainEqual([OpCode.SetEvent, moving.lynxId, "bindEvent", "tap", 1]);
	});

	it("is not made again when it moves within its cell, or from the page into a cell", () => {
		const { renderer, element, ops } = rendererFixture();
		const list = element("list");
		const cell = element("list-item", list);
		const a = element("view", cell);
		const b = element("view", cell);
		const onPage = element("view");
		ops();
		renderer.insert(cell, b, a);
		renderer.insert(cell, onPage, null);
		expect(ops().filter((op) => op[0] === OpCode.Create || op[0] === OpCode.Release)).toEqual([]);
	});
});
