// The renderer's branch marks: where each block Svelte's `$.if` recorded is among its parent's Lynx
// children, written once the parent has a Lynx element. Svelte's part is played by hand here: the
// recorder hears where a branch starts, the branch's nodes go in before the anchor, and it hears the
// key.

import { describe, expect, it } from "@rstest/core";

import { branchMarks } from "../../../src/background/renderer/branch-marks.ts";
import { TreeNode } from "../../../src/background/renderer/node.ts";
import { OpQueue } from "../../../src/background/renderer/queue.ts";
import { link, unlink } from "../../../src/background/renderer/tree.ts";
import { OpCode } from "../../../src/wire/index.ts";

let nextId = 10;

const element = (tag: string, made = true): TreeNode => {
	const node = new TreeNode("element");
	node.tag = tag;
	if (made) node.lynxId = nextId++;
	return node;
};
const anchor = (): TreeNode => new TreeNode("comment");

function setup() {
	const queue = new OpQueue();
	const marks = branchMarks(queue);
	marks.start();
	/** A block at `at` (an anchor under `parent`) takes `key`, its branch `nodes` put before it. */
	const block = (at: TreeNode, key: number, nodes: TreeNode[]): void => {
		const started = marks.recorder.start(at);
		for (const node of nodes) link(at.parent!, node, at);
		marks.recorder.taken(at, key, started);
	};
	return { queue, marks, block };
}

describe("the branch marks", () => {
	it("say where a block is and how many entries it holds, as its parent is made", () => {
		const { queue, marks, block } = setup();
		const view = element("view");
		const title = element("text");
		link(view, title, null);
		const at = anchor();
		link(view, at, null);
		block(at, 0, [element("text"), element("image")]);
		link(view, element("text"), null);
		marks.made(view);
		expect(queue.take()).toEqual([[OpCode.Branch, view.lynxId, 0, 2, 3]]);
		marks.end();
	});

	it("count an inner block as one entry, and an anchor with a Lynx element as one more", () => {
		const { queue, marks, block } = setup();
		const view = element("text");
		const outer = anchor();
		link(view, outer, null);
		const inner = element("raw-text");
		const started = marks.recorder.start(outer);
		link(view, inner, outer);
		block(inner, -1, [element("text")]);
		marks.recorder.taken(outer, 0, started);
		marks.made(view);
		expect(queue.take()).toEqual([
			[OpCode.Branch, view.lynxId, -1, 1, 1],
			[OpCode.Branch, view.lynxId, 0, 2, 2],
		]);
		marks.end();
	});

	it("write a block's mark with nothing in it, and none under a list of the page", () => {
		const { queue, marks, block } = setup();
		const view = element("view");
		const at = anchor();
		link(view, at, null);
		block(at, -1, []);
		const list = element("list");
		const inList = anchor();
		link(list, inList, null);
		block(inList, 0, [element("list-item")]);
		marks.made(view);
		marks.made(list);
		expect(queue.take()).toEqual([[OpCode.Branch, view.lynxId, -1, 0, 0]]);
		marks.end();
	});

	it("write the marks of blocks that rendered into an element made already once the page has rendered", () => {
		const { queue, marks, block } = setup();
		const root = element("page");
		const at = anchor();
		link(root, at, null);
		block(at, 1, [element("view")]);
		expect(queue.take()).toEqual([]);
		marks.end();
		expect(queue.take()).toEqual([[OpCode.Branch, root.lynxId, 1, 1, 1]]);
	});

	it("make the parent unreadable when a block takes a branch again after its mark", () => {
		const { queue, marks, block } = setup();
		const view = element("view");
		const at = anchor();
		link(view, at, null);
		block(at, 0, [element("text")]);
		marks.made(view);
		queue.take();
		block(at, -1, []);
		expect(queue.take()).toEqual([[OpCode.Branch, view.lynxId, -1, 0, -1]]);
		marks.end();
	});

	it("make the parent unreadable when a block's content moved away from its anchor", () => {
		const { queue, marks, block } = setup();
		const view = element("view");
		const at = anchor();
		link(view, at, null);
		const moved = element("text");
		block(at, 0, [moved]);
		unlink(moved);
		link(element("view"), moved, null);
		marks.made(view);
		expect(queue.take()).toEqual([[OpCode.Branch, view.lynxId, 0, 0, -1]]);
		marks.end();
	});

	it("write nothing once the page has rendered", () => {
		const { queue, marks, block } = setup();
		marks.end();
		const view = element("view");
		const at = anchor();
		link(view, at, null);
		block(at, 0, [element("text")]);
		marks.made(view);
		expect(queue.take()).toEqual([]);
	});
});
