// `tick()` and then an element's method: after `await tick()` the background's tree is current,
// and the method's call reaches the main thread after the ops of that update, so it sees them.

import { expect, it } from "@rstest/core";

import Ticked from "../fixtures/threads/Ticked.svelte";
import { startSveltePage } from "./svelte-page.ts";

it("calls the method after the ops of the update that tick() waited for", async () => {
	const handles: Record<string, unknown> = {};
	const page = startSveltePage(Ticked, { props: () => ({ handles }) });
	await page.settle();
	const seen: string[] = [];
	page.engine.respondWith((_method, _params, element) => {
		seen.push(page.engine.state(element).classes);
		return { code: 0, data: { width: 1 } };
	});
	const sent = page.patches.length;
	const answer = page.asBackground(() => (handles["grow"] as () => Promise<unknown>)());
	await page.settle();
	await expect(answer).resolves.toEqual({ width: 1 });
	// The background's tree was current after tick().
	expect(handles["class"]).toBe("box wide");
	// The element had the update when Lynx ran the method.
	expect(seen).toEqual(["box wide"]);
	// The update's ops, then the call, in the order they were made. The ops went when Svelte's
	// update ended, before the code after tick() ran: the call comes in the next patch.
	expect(page.patches.slice(sent)).toHaveLength(2);
	const items = page.patches.slice(sent).flatMap((patch) => patch.items.map((item) => item[0]));
	expect(items).toEqual(["ops", "call"]);
	expect(page.errors).toEqual([]);
});
