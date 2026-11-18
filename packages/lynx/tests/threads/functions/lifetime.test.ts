// A page's main-thread functions end with the page. A page that reloads starts its refs and calls
// afresh: a call the old page's timer makes rejects at once, the old page's function refs are
// cleaned up as its elements go, and a ref made at a module's top level starts again from its
// initial value. A page that ends cleans up the same way, and a call made after rejects.

import { describe, expect, it } from "@rstest/core";

import Lifetime from "../../fixtures/threads/functions/Lifetime.svelte";
import drawLifetime from "../../fixtures/threads/functions/Lifetime.svelte?first-frame";
import { startFunctionsPage } from "./pages.ts";

async function lifetime() {
	const api: Record<string, () => Promise<unknown>> = {};
	const page = startFunctionsPage(Lifetime, { draw: drawLifetime, props: { api } });
	await page.settle();
	const read = async () => {
		const answer = page.asBackground(() => api["read"]!());
		await page.settle();
		return answer;
	};
	return { page, api, read };
}

describe("a page that reloads", () => {
	it("rejects at once a call its old page's timer makes, and cleans up the old page's refs", async () => {
		const { page } = await lifetime();
		const old = page.byClass("tap");
		page.engine.dispatch(old, { type: "tap" });
		page.reload();
		await page.settle();
		expect(page.engine.state(old).attrs["late"]).toBe("page_is_gone");
		expect(page.engine.state(old).attrs["cleaned"]).toBe("yes");
		expect(page.byClass("tap")).not.toBe(old);
		expect(page.errors).toEqual([]);
	});

	it("starts a ref made at a module's top level again from its initial value", async () => {
		const { page, read } = await lifetime();
		page.engine.dispatch(page.byClass("tap"), { type: "tap" });
		page.engine.dispatch(page.byClass("tap"), { type: "tap" });
		expect(await read()).toBe(2);
		page.reload();
		await page.settle();
		expect(page.runtime.page.functions.sizes().refs).toBe(0);
		expect(await read()).toBe(0);
	});
});

describe("a page that ends", () => {
	it("cleans up its function refs, and rejects a call made after", async () => {
		const { page, api } = await lifetime();
		const element = page.byClass("tap");
		page.engine.dispatch(element, { type: "tap" });
		page.destroy();
		await page.settle();
		expect(page.engine.state(element).attrs["cleaned"]).toBe("yes");
		expect(page.engine.state(element).attrs["late"]).toBe("page_is_gone");
		await expect(page.asBackground(() => api["read"]!())).rejects.toMatchObject({
			code: "page_is_gone",
		});
	});
});
