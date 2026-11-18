// Main-thread refs: `main-thread:ref` puts its element in a ref, which main-thread functions share
// and the background reads through them, or runs a function with its element once the element is
// in the tree, and that function's cleanup when it changes or its element goes. The element a
// function meets is one object wherever it meets it.

import { describe, expect, it } from "@rstest/core";

import Refs from "../../fixtures/threads/functions/Refs.svelte";
import drawRefs from "../../fixtures/threads/functions/Refs.svelte?first-frame";
import { startFunctionsPage, tap } from "./pages.ts";

async function refs() {
	const log: unknown[][] = [];
	const api: Record<string, () => unknown> = {};
	const page = startFunctionsPage(Refs, { draw: drawRefs, props: { log, api } });
	await page.settle();
	/** What `run` makes the background ask of the main thread, once both threads have answered. */
	const ask = async <T>(run: () => Promise<T>): Promise<T> => {
		const answer = page.asBackground(run);
		await page.settle();
		return answer;
	};
	const change = async (name: string) => {
		page.asBackground(() => api[name]!());
		await page.settle();
	};
	return { page, log, api, ask, change };
}

describe("a main-thread ref", () => {
	it("holds its element, the same one the element's events carry", async () => {
		const { page, log, api, ask } = await refs();
		expect(await ask(() => api["read"]!() as Promise<unknown>)).toBe("first");
		await tap(page, "inner");
		expect(log.at(-1)).toEqual(["tap", true, true, "holder"]);
	});

	it("gives its element a view of its own", async () => {
		const { page } = await refs();
		expect(page.engine.state(page.byClass("first")).attrs["flatten"]).toBe(false);
		expect(page.engine.state(page.byClass("attached")).attrs["flatten"]).toBe(false);
	});

	it("moves with the attribute, and holds nothing once no element has it", async () => {
		const { api, ask, change } = await refs();
		await change("move");
		expect(await ask(() => api["read"]!() as Promise<unknown>)).toBe("second");
		await change("move");
		expect(await ask(() => api["read"]!() as Promise<unknown>)).toBe("first");
	});

	it("keeps a style a main-thread function set when the background writes the style", async () => {
		const { page, change } = await refs();
		await tap(page, "inner");
		await change("widen");
		const styles = page.engine.state(page.byClass("first")).inlineStyles;
		expect(styles.get("width")).toBe("20px");
		expect(styles.get("transform")).toBe("translateX(5px)");
	});
});

describe("a function given as main-thread:ref", () => {
	it("runs once, with its element in the tree, and leaves the page drawn when another throws", async () => {
		const { page, log } = await refs();
		expect(log.filter(([what]) => what === "attach")).toEqual([["attach", "a", true, "attached"]]);
		expect(page.engine.texts()).toContain("after");
		expect(page.errors).toEqual([expect.objectContaining({ message: "The ref threw." })]);
	});

	it("cleans up, then runs again, when what it captured changes", async () => {
		const { log, change } = await refs();
		await change("relabel");
		expect(log.slice(1)).toEqual([
			["cleanup", "a"],
			["attach", "b", true, "attached"],
		]);
	});

	it("goes with its element: the page keeps no binding or wrapper of it", async () => {
		const { page, change } = await refs();
		const before = page.runtime.page.functions.sizes();
		await change("hide");
		const after = page.runtime.page.functions.sizes();
		expect(after.bindings).toBe(before.bindings - 1);
		expect(after.elements).toBe(before.elements - 1);
	});

	it("cleans up when its element goes, and runs when it comes back", async () => {
		const { log, change } = await refs();
		await change("hide");
		await change("show");
		expect(log.slice(1)).toEqual([
			["cleanup", "a"],
			["attach", "a", true, "attached"],
		]);
	});
});
