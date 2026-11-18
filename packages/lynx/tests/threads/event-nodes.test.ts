// An event's targets are the element nodes themselves, the ones an attachment gets, with Lynx's
// id, dataset and uid of the element; and the tree questions a component asks of a node.

import { describe, expect, it } from "@rstest/core";

import type { ElementNode } from "../../src/background/renderer/renderer.ts";
import Targets from "../fixtures/threads/Targets.svelte";
import { startSveltePage } from "./svelte-page.ts";

async function targets() {
	const seen = new Map<string, unknown>();
	const page = startSveltePage(Targets, {
		props: () => ({ seen: (name: string, value: unknown) => seen.set(name, value) }),
	});
	await page.settle();
	const tap = async (token: string) => {
		page.engine.dispatch(page.byClass(token), { type: "tap" });
		await page.settle();
	};
	const node = (name: string) => seen.get(name) as ElementNode;
	const event = (name: string) => seen.get(name) as { target: unknown; currentTarget: unknown };
	return { page, tap, node, event };
}

describe("the targets of an event", () => {
	it("are the nodes an attachment got, with no copy between", async () => {
		const { tap, node, event } = await targets();
		await tap("tagged");
		expect(event("tagged-event").target).toBe(node("tagged"));
		expect(event("tagged-event").currentTarget).toBe(node("tagged"));
	});

	it("answer id, dataset and uid as Lynx reports them for the element", async () => {
		const { page, tap, node } = await targets();
		await tap("tagged");
		await tap("plain");
		const tagged = node("tagged");
		expect(tagged.id).toBe("tagged");
		expect(tagged.dataset).toEqual({ n: 1, s: "x", o: { a: 1 }, mark: "yes" });
		expect(tagged.uid).toBe(page.engine.state(page.byClass("tagged")).uid);
		expect(node("plain").id).toBe("");
		expect(node("plain").dataset).toEqual({});
		expect(node("text").uid).toBeUndefined();
	});

	it("follow an update, and a data attribute that is removed", async () => {
		const { tap, node } = await targets();
		await tap("change");
		expect(node("tagged").dataset).toEqual({ n: 1, s: "x", o: { a: 1 } });
	});

	it("run their own listeners with dispatchEvent, the node as the target", async () => {
		const { node, event } = await targets();
		node("tagged").dispatchEvent({ type: "tap" });
		expect(event("tagged-event").target).toBe(node("tagged"));
	});
});

describe("the nodes of the page", () => {
	it("sort into the order the page draws them, and follow a keyed each's moves", async () => {
		const { tap, node } = await targets();
		const items = [1, 2, 3].map((item) => node(`item-${item}`));
		const sorted = () => [...items].sort((a, b) => a.compareOrder(b));
		expect(sorted()).toEqual(items);
		expect(node("tagged").compareOrder(node("text"))).toBeLessThan(0);
		expect(node("text").compareOrder(node("tagged"))).toBeGreaterThan(0);
		await tap("change");
		expect(sorted()).toEqual(items.toReversed());
	});

	it("answer contains, isConnected and parentElement", async () => {
		const { node } = await targets();
		expect(node("tagged").contains(node("text"))).toBe(true);
		expect(node("text").contains(node("tagged"))).toBe(false);
		expect(node("tagged").contains(null)).toBe(false);
		expect(node("text").parentElement).toBe(node("tagged"));
		expect(node("tagged").parentElement?.tag).toBe("page");
		expect(node("tagged").isConnected).toBe(true);
	});

	it("are not connected, nor what is inside them, once removed, and come after the page's", async () => {
		const { tap, node } = await targets();
		const gone = node("gone");
		await tap("change");
		expect(gone.isConnected).toBe(false);
		expect(node("inner").isConnected).toBe(false);
		expect(gone.parentElement).toBeNull();
		expect(node("tagged").compareOrder(gone)).toBeLessThan(0);
		expect(gone.compareOrder(node("tagged"))).toBeGreaterThan(0);
	});
});
