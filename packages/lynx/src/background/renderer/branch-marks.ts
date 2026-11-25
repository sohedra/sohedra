// The branch marks: which branch each of Svelte's blocks took as the page started, for hydration to
// pair the first frame's blocks with by it (`OpCode.Branch`). While the page starts, Svelte's `$.if`
// tells the recorder each block's anchor, its key and where its content starts
// (../../svelte/runtime/branch-marks.ts); the mark is written once the anchor's parent has a Lynx
// element, with its other ops: as the element is made, after its children, or, for a block that
// rendered into an element made already, once the page has rendered.
//
// A mark says where its block is among its parent's Lynx children: `at` of them come before its
// anchor, and its content is the last `count` entries there, an inner block being one entry and
// an anchor that has a Lynx element (a text inside a `<text>`) one more. A list of the page gets
// none: its cells pair by key. A block hydration could pair wrongly gets an unreadable mark
// (`at` -1), so its parent's children are made again: one whose content was moved away from its
// anchor, or one that took a branch again while the page started, before its mark or after.

import { recordBranches } from "../../svelte/runtime/index.ts";
import type { BranchRecorder } from "../../svelte/runtime/index.ts";
import { OpCode } from "../../wire/index.ts";
import type { TreeNode } from "./node.ts";
import type { OpQueue } from "./queue.ts";

/** The renderer's side of the marks. */
export interface BranchMarks {
	/** What Svelte's `$.if` tells while the page starts. */
	readonly recorder: BranchRecorder;
	/** The page starts: blocks are recorded and marks written. */
	start(): void;
	/** `element` was made, with its children: the marks of the blocks among them. */
	made(element: TreeNode): void;
	/** `node` joined `container`, an element made already. */
	joined(container: TreeNode, node: TreeNode): void;
	/** The page has rendered: the marks left are written, and nothing more is recorded. */
	end(): void;
}

/** Makes the marks of a renderer that writes its ops into `queue`. */
export function branchMarks(queue: OpQueue): BranchMarks {
	let marking = false;
	/** The anchors recorded, to forget once the page has rendered. */
	const anchors: TreeNode[] = [];
	/** Elements made already that a block rendered into: their marks wait for the page. */
	const late = new Set<TreeNode>();

	const unreadable = (parent: TreeNode, key: number): void =>
		queue.push([OpCode.Branch, parent.lynxId, key, 0, -1]);

	const recorder: BranchRecorder = {
		// Boundary: Svelte hands the recorder the renderer's own nodes.
		start: (anchor) => (anchor as TreeNode).prev ?? (anchor as TreeNode).parent,
		taken(anchor, key, started) {
			// Boundary: as above.
			const node = anchor as TreeNode;
			const parent = node.parent;
			let first: TreeNode | null = null;
			if (parent && started !== node)
				first = started === parent ? parent.first : (started as TreeNode).next;
			const before = node.branch;
			if (before?.written) {
				if (parent && parent.lynxId !== 0) unreadable(parent, key);
				return;
			}
			if (!before) anchors.push(node);
			// A block that ran again while the page starts: what its content is cannot be told.
			node.branch = {
				key,
				first: first === node ? null : first,
				written: false,
				again: before !== null,
			};
			if (parent && parent.lynxId !== 0) late.add(parent);
		},
	};

	/** The entries from the block's first node back from its anchor, or -1 when it is not there. */
	function count(anchor: TreeNode, first: TreeNode): number {
		let entries = 0;
		for (let back = anchor.prev; back; back = back.prev) {
			if (back.lynxId !== 0) entries++;
			// A block marked before this one is one entry: its content is in it.
			const inner = back.branch;
			if (inner?.written) {
				entries++;
				back = inner.first ?? back;
			}
			if (back === first) return entries;
		}
		return -1;
	}

	/** The marks of the blocks among `element`'s children that are not marked yet. */
	function write(element: TreeNode): void {
		const listOfPage = element.tag === "list" && element.cell === 0;
		let at = 0;
		for (let child = element.first; child; child = child.next) {
			const block = child.branch;
			if (block && !block.written) {
				block.written = true;
				const entries = block.again ? -1 : block.first === null ? 0 : count(child, block.first);
				if (listOfPage) {
					// Its cells pair by key.
				} else if (entries === -1) unreadable(element, block.key);
				else queue.push([OpCode.Branch, element.lynxId, block.key, entries, at]);
			}
			if (child.lynxId !== 0) at++;
		}
	}

	return {
		recorder,
		start() {
			marking = true;
			recordBranches(recorder);
		},
		made(element) {
			if (marking) write(element);
		},
		joined(container, node) {
			if (marking && node.branch) late.add(container);
		},
		end() {
			if (!marking) return;
			recordBranches(null);
			for (const element of late) if (element.lynxId !== 0) write(element);
			marking = false;
			for (const anchor of anchors) anchor.branch = null;
			anchors.length = 0;
			late.clear();
		},
	};
}
