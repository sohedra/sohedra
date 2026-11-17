// The tree questions a node answers: contains, compareOrder, isConnected and parentElement.

import { describe, expect, it } from "@rstest/core";

import type { ElementNode } from "../../../src/background/renderer/renderer.ts";
import { rendererFixture } from "./renderer-fixture.ts";

function tree() {
	const fixture = rendererFixture();
	const a = fixture.element("view");
	const a1 = fixture.element("view", a);
	const a2 = fixture.element("view", a);
	const deep = fixture.element("view", a2);
	const b = fixture.element("view");
	return { ...fixture, a, a1, a2, deep, b };
}

describe("contains", () => {
	it("is true for the node itself and what is inside it, at any depth", () => {
		const { a, a2, deep } = tree();
		expect(a.contains(a)).toBe(true);
		expect(a.contains(deep)).toBe(true);
		expect(a2.contains(deep)).toBe(true);
	});

	it("is false the other way, between siblings, and for what is not a node", () => {
		const { a, a1, a2, deep } = tree();
		expect(deep.contains(a)).toBe(false);
		expect(a1.contains(a2)).toBe(false);
		expect(a.contains(null)).toBe(false);
		expect(a.contains({})).toBe(false);
	});

	it("finds nodes that came in with a fragment, among the anchors Svelte keeps", () => {
		const { renderer, a } = tree();
		const fragment = renderer.createFragment();
		const anchor = renderer.createComment("");
		const inner = renderer.createElement("view");
		renderer.insert(fragment, anchor, null);
		renderer.insert(fragment, inner, null);
		renderer.insert(a, fragment, null);
		expect(a.contains(inner)).toBe(true);
		expect(renderer.getFirstChild(fragment)).toBeNull();
	});
});

describe("compareOrder", () => {
	it("is 0 for the same node and for what is not a node", () => {
		const { a } = tree();
		expect(a.compareOrder(a)).toBe(0);
		expect(a.compareOrder({})).toBe(0);
	});

	it("puts a node before what is inside it, siblings in order, and cousins by their ancestors", () => {
		const { a, a1, a2, deep, b } = tree();
		expect(a.compareOrder(deep)).toBeLessThan(0);
		expect(deep.compareOrder(a)).toBeGreaterThan(0);
		expect(a1.compareOrder(a2)).toBeLessThan(0);
		expect(deep.compareOrder(a1)).toBeGreaterThan(0);
		expect(deep.compareOrder(b)).toBeLessThan(0);
	});

	it("puts the page's node first when two are not in one tree, and is 0 when neither is", () => {
		const { renderer, a } = tree();
		const loose = renderer.createElement("view") as ElementNode;
		const other = renderer.createElement("view") as ElementNode;
		expect(a.compareOrder(loose)).toBeLessThan(0);
		expect(loose.compareOrder(a)).toBeGreaterThan(0);
		expect(loose.compareOrder(other)).toBe(0);
	});

	it("follows a node that moves, and sorts nodes into tree order", () => {
		const { renderer, a, a1, a2, b } = tree();
		renderer.insert(a, a2, a1);
		expect(a2.compareOrder(a1)).toBeLessThan(0);
		expect([b, a1, a2, a].sort((x, y) => x.compareOrder(y))).toEqual([a, a2, a1, b]);
	});

	it("walks from both siblings of a long list at once", () => {
		const { element } = rendererFixture();
		const list = element("view");
		const items = Array.from({ length: 200 }, () => element("view", list));
		expect(items[150]!.compareOrder(items[151]!)).toBeLessThan(0);
		expect(items[199]!.compareOrder(items[0]!)).toBeGreaterThan(0);
	});
});

describe("isConnected and parentElement", () => {
	it("answer for a page node, and for a removed one and what is inside it", () => {
		const { renderer, root, a, a2, deep } = tree();
		expect(deep.isConnected).toBe(true);
		expect(a.parentElement).toBe(root);
		renderer.remove(a2);
		expect(a2.isConnected).toBe(false);
		expect(deep.isConnected).toBe(false);
		expect(a2.parentElement).toBeNull();
		expect(deep.parentElement).toBe(a2);
	});

	it("is null for a node whose holder is not an element", () => {
		const { renderer } = tree();
		const fragment = renderer.createFragment();
		const inner = renderer.createElement("view") as ElementNode;
		renderer.insert(fragment, inner, null);
		expect(inner.parentElement).toBeNull();
		expect(renderer.getParent(inner)).toBe(fragment);
	});
});
