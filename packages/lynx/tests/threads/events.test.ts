// The four spellings of an event on an element, each in its phase, and a catch that keeps a tap
// from the parent, on the element and in a spread.

import { describe, expect, it } from "@rstest/core";

import Events from "../fixtures/threads/Events.svelte";
import { startSveltePage } from "./svelte-page.ts";

async function events() {
	const page = startSveltePage(Events);
	await page.settle();
	const tap = async (token: string) => {
		page.engine.dispatch(page.byClass(token), { type: "tap" });
		await page.settle();
	};
	const log = () => page.engine.text(page.byClass("log"));
	return { page, tap, log };
}

describe("an event's four spellings on one element", () => {
	it("bind with Lynx's bind type for each phase", async () => {
		const { page } = await events();
		const bindTypes = page.engine
			.state(page.byClass("forms"))
			.listeners.map((listener) => listener.options);
		expect(bindTypes).toEqual([
			{ closure_type: 2, bind_type: 1 },
			{ closure_type: 2, bind_type: 2 },
			{ closure_type: 2, bind_type: 4 },
			{ closure_type: 2, bind_type: 3 },
		]);
	});

	it("each reach their phase: capture from the page down, then the target's own, and no bubble past a catch", async () => {
		const { tap, log } = await events();
		await tap("forms");
		expect(log()).toBe("outer-capture,capture,catch-capture,bubble,catch");
	});
});

describe("a catch", () => {
	it("keeps a tap from the parent, which a plain listener lets through", async () => {
		const { tap, log } = await events();
		await tap("caught");
		expect(log()).toBe("outer-capture,caught");
		await tap("bound");
		expect(log()).toBe("outer-capture,caught,outer-capture,bound,outer");
	});

	it("works in a spread too, where only on… functions pass", async () => {
		const { tap, log } = await events();
		await tap("spread-caught");
		await tap("spread-bound");
		expect(log()).toBe("outer-capture,spread-caught,outer-capture,spread-bound,outer");
	});
});
