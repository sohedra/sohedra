// What a page keeps of main-thread functions only as long as it needs it: no context for an
// attribute that cannot be sent or binds nothing, and no wrapper for an element it let go of, even
// when a function kept one past its element's life.

import { describe, expect, it } from "@rstest/core";

import Leaks from "../../fixtures/threads/functions/Leaks.svelte";
import drawLeaks from "../../fixtures/threads/functions/Leaks.svelte?first-frame";
import { expectAccounted } from "./accounting.ts";
import { startFunctionsPage, tap } from "./pages.ts";

async function leaks() {
	const api: Record<string, (name: string, value: boolean) => void> = {};
	const page = startFunctionsPage(Leaks, { draw: drawLeaks, props: { api } });
	await page.settle();
	const set = async (name: string, value: boolean) => {
		page.asBackground(() => api["set"]!(name, value));
		await page.settle();
	};
	const sizes = () => page.runtime.page.functions.sizes();
	return { page, set, sizes };
}

describe("a page's main-thread functions", () => {
	it("keep no context for an attribute that cannot be sent", async () => {
		const { page, set } = await leaks();
		await set("big", true);
		expect(page.errors).toEqual([expect.objectContaining({ code: "attribute_not_copyable" })]);
		expectAccounted(page, "after an attribute that cannot be sent");
	});

	it("keep no context for a main-thread attribute that binds nothing", async () => {
		const { page, set } = await leaks();
		await set("unknown", true);
		expect(page.errors).toEqual([
			expect.objectContaining({ code: "main_thread_attribute_unknown" }),
		]);
		expectAccounted(page, "after an attribute that binds nothing");
	});

	it("keep no wrapper of an element a cleanup looked at", async () => {
		const { set, sizes } = await leaks();
		await set("shown", false);
		expect(sizes().elements).toBe(0);
	});

	it("keep no wrapper of what a wrapper kept past its element reaches, and refuse its changes", async () => {
		const { page, set, sizes } = await leaks();
		await tap(page, "inner");
		await set("shown", false);
		const left = sizes().elements;
		// Each tap wraps the element it hits, and nothing the kept wrapper reaches.
		await tap(page, "use");
		expect(sizes().elements).toBe(left + 1);
		await tap(page, "write");
		expect(sizes().elements).toBe(left + 2);
		expect(page.errors).toEqual([
			expect.objectContaining({
				code: "element_released",
				message: expect.stringMatching(
					/^A main-thread function called setAttribute on an element the page has let go of/,
				),
			}),
		]);
	});
});
