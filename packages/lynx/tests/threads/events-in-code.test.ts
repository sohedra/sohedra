// `on()` from `svelte/events` where no effect runs: in an event handler, and after an `await` in
// one. Svelte's `on()` listens through the renderer that is current when it is called; with none,
// it takes the DOM's path, whose propagation does not fit a Lynx event (`currentTarget` is lost
// for an event that bubbled to the node).

import { describe, expect, it } from "@rstest/core";

import Listen from "../fixtures/threads/Listen.svelte";
import { startSveltePage } from "./svelte-page.ts";

async function listen() {
	const log: unknown[] = [];
	const page = startSveltePage(Listen, { props: () => ({ log }) });
	await page.settle();
	const send = async (token: string, type: string) => {
		page.engine.dispatch(page.byClass(token), { type });
		await page.settle();
	};
	const listeners = (name: string) =>
		page.engine.state(page.byClass("box")).listeners.filter((listener) => listener.name === name);
	return { page, log, send, listeners };
}

describe("on() outside an effect", () => {
	it("listens on the node from a tap handler, and hears an event that bubbled to it", async () => {
		const { page, log, send, listeners } = await listen();
		await send("listen", "tap");
		expect(listeners("longpress")).toHaveLength(1);
		await send("inner", "longpress");
		expect(log).toEqual([["longpress", true]]);
		expect(page.errors).toEqual([]);
	});

	it("listens on the node after an await in a handler, as in an effect", async () => {
		const { page, log, send, listeners } = await listen();
		await send("listen-later", "tap");
		expect(listeners("tap")).toHaveLength(1);
		await send("inner", "tap");
		expect(log).toEqual([["tap", true]]);
		expect(page.errors).toEqual([]);
	});

	it("stops listening when the function it returned is called", async () => {
		const { send, listeners } = await listen();
		await send("listen-later", "tap");
		await send("unlisten", "tap");
		expect(listeners("tap")).toHaveLength(0);
	});
});
