// An element's UI methods through the public library: what Lynx answers is the test's to say.

import { expect, it } from "@rstest/core";
import { fireEvent, render } from "@sohedra/lynx/testing";

import Invoke from "../fixtures/library/Invoke.svelte";

async function setup() {
	const results: unknown[] = [];
	const page = await render(Invoke, { props: { results } });
	const byClass = (name: string) => page.container.querySelector(`.${name}`)!;
	return { ...page, results, byClass };
}

it("calls the UI method on the Lynx element and resolves with its data", async () => {
	const { lynx, results, byClass } = await setup();
	lynx.respondInvoke(({ method }) => ({ code: 0, data: { scrolled: method === "scrollTo" } }));
	await fireEvent.tap(byClass("scroll"));
	expect(lynx.invocations.at(-1)).toMatchObject({
		element: byClass("scroller"),
		method: "scrollTo",
		params: { offset: 120, smooth: true },
	});
	expect(results.at(-1)).toEqual({ ok: { scrolled: true } });
});

it("rejects with the reason Lynx reports", async () => {
	const { lynx, results, byClass } = await setup();
	lynx.respondInvoke(() => ({ code: 3 }));
	await fireEvent.tap(byClass("scroll"));
	expect(results.at(-1)).toEqual({ error: expect.stringContaining("scrollTo") });
});

it("sends what was queued before the call first, so a new element can be called at once", async () => {
	const { lynx, results, byClass } = await setup();
	lynx.respondInvoke(() => ({ code: 0, data: { width: 10 } }));
	await fireEvent.tap(byClass("add"));
	const call = lynx.invocations.at(-1)!;
	expect(call.method).toBe("boundingClientRect");
	expect(call.element).toBe(byClass("fresh"));
	expect(results.at(-1)).toEqual({ ok: { width: 10 } });
});

it("answers boundingClientRect with the box a test gives the element", async () => {
	const { lynx, results, byClass } = await setup();
	lynx.respondInvoke(() => ({ code: 0, data: "not this" }));
	lynx.setBoundingClientRect(byClass("measure"), { left: 4, top: 8, width: 100, height: 40 });
	await fireEvent.tap(byClass("measure"));
	expect(results.at(-1)).toEqual({
		ok: { left: 4, top: 8, width: 100, height: 40, right: 104, bottom: 48 },
	});
	// Another element, or another method, gets what respondInvoke answers.
	await fireEvent.tap(byClass("add"));
	expect(results.at(-1)).toEqual({ ok: "not this" });
});

it("rejects for an element that was removed", async () => {
	const { lynx, results, byClass } = await setup();
	await fireEvent.tap(byClass("hide"));
	await fireEvent.tap(byClass("scroll"));
	expect(lynx.invocations).toHaveLength(0);
	expect(results.at(-1)).toEqual({ error: expect.stringContaining("not on the page") });
});
