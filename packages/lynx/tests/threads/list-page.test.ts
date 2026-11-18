// A page of rows from a keyed each: several roots in order under the page, listeners with their
// bind types, data-* in the dataset, a reorder that moves the same elements, and handlers let go
// of with the rows that held them.

import { describe, expect, it } from "@rstest/core";

import Rows from "../fixtures/threads/Rows.svelte";
import { startSveltePage } from "./svelte-page.ts";

async function rows() {
	const page = startSveltePage(Rows);
	await page.settle();
	const tap = async (token: string) => {
		page.engine.dispatch(page.byClass(token), { type: "tap" });
		await page.settle();
	};
	const roots = () =>
		[...page.engine.page()!.childNodes].map(
			(node) => page.engine.state(node as never).classes.split(" ")[0],
		);
	return { page, tap, roots };
}

describe("a page of rows", () => {
	it("puts its roots in order under the page", async () => {
		const { roots } = await rows();
		expect(roots()).toEqual(["header", "row", "row", "row", "extra", "reverse", "count"]);
	});

	it("binds ontap, oncatchtap and ontapcapture with their bind types", async () => {
		const { page } = await rows();
		const options = (token: string) =>
			page.engine
				.state(page.byClass(token))
				.listeners.map((listener) => listener.options.bind_type);
		expect(options("row-1")).toEqual([1]);
		expect(options("remove-1")).toEqual([4]);
		expect(options("extra")).toEqual([1, 2]);
	});

	it("puts data-* in Lynx's dataset, not in the attributes", async () => {
		const { page } = await rows();
		const row = page.engine.state(page.byClass("row-2"));
		expect(row.dataset).toEqual({ id: 2, label: "two" });
		expect(Object.keys(row.attrs).filter((name) => name.startsWith("data-"))).toEqual([]);
	});

	it("reorders a keyed each by moving the same elements", async () => {
		const { page, tap } = await rows();
		const before = [1, 2, 3].map((id) => page.byClass(`row-${id}`));
		const made = page.engine.madeCount("view");
		await tap("reverse");
		const order = [...page.engine.page()!.childNodes].filter((node) =>
			before.includes(node as never),
		);
		expect(order).toEqual(before.toReversed());
		expect(page.engine.madeCount("view")).toBe(made);
	});

	it("removes a row from its own handler, and lets go of the row's handlers", async () => {
		const { page, tap } = await rows();
		const listeners = page.engine.listenerCount();
		await tap("remove-2");
		expect(page.engine.texts()).not.toContain("two");
		expect(page.engine.listenerCount()).toBe(listeners - 2);
		expect(page.errors).toEqual([]);
	});

	it("lets go of every handler of an element an {#if} removes", async () => {
		const { page, tap } = await rows();
		const listeners = page.engine.listenerCount();
		await tap("extra");
		expect(page.engine.texts()).not.toContain("extra");
		expect(page.engine.listenerCount()).toBe(listeners - 2);
	});
});
