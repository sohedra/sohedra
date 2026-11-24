// What the threads let go of once the engine's collector has run: a copy of a main-thread function
// the main thread no longer holds lets the background drop its context, and a ref the background no
// longer holds is forgotten on the main thread with the next patch.

import { setFlagsFromString } from "node:v8";
import { runInNewContext } from "node:vm";

import { expect, it } from "@rstest/core";

import { keptContexts } from "../../../src/background/functions/calls.ts";
import { mainThreadRef } from "../../../src/background/root-entry.ts";
import Events from "../../fixtures/threads/functions/Events.svelte";
import drawEvents from "../../fixtures/threads/functions/Events.svelte?first-frame";
import Unref from "../../fixtures/threads/functions/Unref.svelte";
import drawUnref from "../../fixtures/threads/functions/Unref.svelte?first-frame";
import { expectAccounted } from "./accounting.ts";
import { startFunctionsPage } from "./pages.ts";

setFlagsFromString("--expose-gc");
// Boundary: a context made after the flag has V8's `gc`.
const gc = runInNewContext("gc") as () => void;

/**
 * Collects what nothing refers to, and runs what the collector found gone, until `done` (at most
 * 50 rounds): V8 runs the callbacks of what it collected on a later task of its choosing, later on a
 * busy machine, so a fixed number of rounds passes here and fails on a loaded CI runner.
 */
async function collect(done: () => boolean | Promise<boolean>): Promise<void> {
	for (let round = 0; round < 50; round++) {
		await new Promise((resolve) => setTimeout(resolve, 0));
		gc();
		await new Promise((resolve) => setTimeout(resolve, 0));
		if (await done()) return;
	}
}

it("lets the background drop the context of a handler built again, once its copy is collected", async () => {
	const api: Record<string, () => void> = {};
	const page = startFunctionsPage(Events, { draw: drawEvents, props: { log: [], api } });
	await page.settle();
	const before = page.asBackground(keptContexts);
	page.asBackground(() => api["next"]!());
	await page.settle();
	expect(page.asBackground(keptContexts)).toHaveLength(before.length + 1);
	await collect(async () => {
		await page.settle();
		return page.asBackground(keptContexts).length === before.length;
	});
	const after = page.asBackground(keptContexts);
	expect(after).toHaveLength(before.length);
	expect(after).not.toEqual(before);
	expectAccounted(page, "after the collector ran");
});

it("forgets on the main thread a ref the background let go of, with the next patch", async () => {
	const api: Record<string, (...args: never[]) => unknown> = {};
	const page = startFunctionsPage(Unref, { draw: drawUnref, props: { api } });
	await page.settle();
	// In a function of its own, so that no local of the test holds the ref.
	const used = await (async () => {
		const answer = page.asBackground(() => api["use"]!(mainThreadRef(7) as never));
		await page.settle();
		return answer;
	})();
	expect(used).toBe(7);
	expect(page.runtime.page.functions.sizes().refs).toBe(1);
	await collect(async () => {
		page.asBackground(() => api["tick"]!());
		await page.settle();
		return page.runtime.page.functions.sizes().refs === 0;
	});
	expect(page.runtime.page.functions.sizes().refs).toBe(0);
});
