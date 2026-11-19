// What a static copy rests on: Svelte never looks inside the container. A copy sits in an element
// among siblings in {#if} and keyed {#each} blocks, and Svelte changes everything around it: the
// siblings' text, siblings added and removed before and after it, the rows reordered so that the
// container itself moves, and at last its parent removed. After each step the copy is still there,
// and Svelte asked the renderer about the container's place only.

import { expect, it } from "@rstest/core";
import type { LynxNode } from "@sohedra/lynx/elements";

import type { TreeNode } from "../../../src/background/renderer/node.ts";
import { pageRenderer } from "../../../src/background/renderer/page-renderer.ts";
import { createStaticCopy } from "../../../src/background/root-entry.ts";
import type { LynxElement } from "../../../src/testing/index.ts";
import CopyBlocks from "../../fixtures/threads/page/CopyBlocks.svelte";
import { startSveltePage } from "../svelte-page.ts";

interface Api {
	setShow(value: boolean): void;
	setText(value: string): void;
	setBefore(value: string[]): void;
	setAfter(value: string[]): void;
	setRows(value: string[]): void;
}

/** The renderer's calls that read, write or walk into a node: what would show Svelte inside. */
const LOOKING_INSIDE = ["getFirstChild", "getLastChild", "setText", "getAttribute"];
/** What Svelte may ask about the container: its place among its siblings. */
const ABOUT_PLACE = ["getNextSibling", "getParent", "getNodeType"];

/** Records each renderer call of `methods`, with its first argument, until the returned stop. */
function spy(calls: { method: string; first: unknown; node: unknown }[]): () => void {
	// Boundary: the renderer's methods, by name.
	const target = pageRenderer as unknown as Record<string, (...args: unknown[]) => unknown>;
	const originals = new Map<string, (...args: unknown[]) => unknown>();
	for (const method of [...LOOKING_INSIDE, ...ABOUT_PLACE, "insert", "remove"]) {
		const original = target[method]!;
		originals.set(method, original);
		target[method] = (...args: unknown[]) => {
			calls.push({ method, first: args[0], node: args[method === "insert" ? 1 : 0] });
			return original(...args);
		};
	}
	return () => {
		for (const [method, original] of originals) target[method] = original;
	};
}

it("keeps a copy inside its container through every change Svelte makes around it", async () => {
	const handles: Record<string, unknown> = {};
	const page = startSveltePage(CopyBlocks, { props: { handles } });
	await page.settle();
	const api = handles["api"] as Api;
	const rowB = handles["row-b"] as LynxNode;
	const copy = page.asBackground(() => createStaticCopy(handles["src"] as LynxNode, rowB));
	await page.settle();

	const inside = (node: unknown): boolean => {
		for (let at = node as TreeNode | null; at; at = at.parent)
			if (at === (rowB as unknown)) return at !== node;
		return false;
	};
	const block = () => page.byClass("block");
	/** The block's children as the page shows them. */
	const order = () =>
		([...(block() as Element).children] as LynxElement[]).map((child) => {
			const state = page.engine.state(child);
			const name = state.classes.split(" ")[0]!;
			return name === "row"
				? `row:${String(state.dataset["row"])}`
				: `${name}:${page.engine.text(child)}`;
		});
	/** The copy is inside the container, once, with the text it had at the call. */
	const copyIsThere = () => {
		const row = ([...(block() as Element).children] as LynxElement[]).find(
			(child) => page.engine.state(child).dataset["row"] === "b",
		)!;
		expect((row as Element).children).toHaveLength(1);
		expect(page.engine.text((row as Element).children[0] as LynxElement)).toBe("one");
		expect(copy.nodes[0]!.parentElement).toBe(rowB);
		expect(copy.nodes[0]!.isConnected).toBe(true);
	};
	const step = async (change: () => void) => {
		page.asBackground(change);
		await page.settle();
		copyIsThere();
	};

	const calls: { method: string; first: unknown; node: unknown }[] = [];
	const restore = spy(calls);
	try {
		expect(order()).toEqual(["lead:one", "src:one", "row:a", "row:b", "row:c", "tail:one"]);
		copyIsThere();

		await step(() => api.setText("two"));
		expect(order()).toEqual(["lead:two", "src:two", "row:a", "row:b", "row:c", "tail:two"]);

		await step(() => api.setBefore(["x", "y"]));
		await step(() => api.setAfter(["p", "q"]));
		expect(order()).toEqual([
			"lead:two",
			"src:two",
			"before:x",
			"before:y",
			"row:a",
			"row:b",
			"row:c",
			"after:p",
			"after:q",
			"tail:two",
		]);
		await step(() => api.setBefore(["y"]));
		await step(() => api.setAfter([]));
		await step(() => api.setBefore([]));
		expect(order()).toEqual(["lead:two", "src:two", "row:a", "row:b", "row:c", "tail:two"]);

		// The rows move: the container is inserted somewhere else, and ends first and last.
		await step(() => api.setRows(["b", "a", "c"]));
		await step(() => api.setRows(["c", "a", "b"]));
		await step(() => api.setRows(["d", "c", "b", "a", "e"]));
		expect(order().slice(2, 7)).toEqual(["row:d", "row:c", "row:b", "row:a", "row:e"]);

		await step(() => {
			api.setText("three");
			api.setBefore(["m"]);
			api.setAfter(["n"]);
			api.setRows(["e", "b", "a"]);
		});
		expect(order()).toEqual([
			"lead:three",
			"src:three",
			"before:m",
			"row:e",
			"row:b",
			"row:a",
			"after:n",
			"tail:three",
		]);
	} finally {
		restore();
	}
	const aboutInside = calls.filter((call) => call.first === rowB || inside(call.first));
	expect(aboutInside.filter((call) => !ABOUT_PLACE.includes(call.method))).toEqual([]);
	expect(calls.some((call) => call.method === "insert" && call.node === rowB)).toBe(true);
	expect(page.errors).toEqual([]);

	// Last, the container's parent goes, and the copy with it.
	page.asBackground(() => api.setShow(false));
	await page.settle();
	expect(copy.nodes[0]!.isConnected).toBe(false);
	expect(page.engine.texts()).toEqual([]);
	expect(() => page.asBackground(() => copy.remove())).not.toThrow();
	// The block comes back with an empty container, to copy into again.
	page.asBackground(() => api.setShow(true));
	await page.settle();
	const rowAgain = ([...(block() as Element).children] as LynxElement[]).find(
		(child) => page.engine.state(child).dataset["row"] === "b",
	)!;
	expect((rowAgain as Element).children).toHaveLength(0);
	expect(page.errors).toEqual([]);
});
