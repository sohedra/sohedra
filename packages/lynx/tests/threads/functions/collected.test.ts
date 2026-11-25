// What the threads let go of once the engine's collector has run: a copy of a main-thread function
// the main thread no longer holds lets the background drop its context, and a ref the background no
// longer holds is forgotten on the main thread with the next patch.

import { setFlagsFromString } from "node:v8";
import { runInNewContext } from "node:vm";

import { expect, it } from "@rstest/core";

import { keptContexts } from "../../../src/background/functions/calls.ts";
import { mainThreadRef } from "../../../src/background/root-entry.ts";
import { FUNCTION_FIELDS } from "../../../src/wire/index.ts";
import type { MainThreadFunction } from "../../../src/wire/index.ts";
import Events from "../../fixtures/threads/functions/Events.svelte";
import drawEvents from "../../fixtures/threads/functions/Events.svelte?first-frame";
import Unref from "../../fixtures/threads/functions/Unref.svelte";
import drawUnref from "../../fixtures/threads/functions/Unref.svelte?first-frame";
import { expectAccounted } from "./accounting.ts";
import { startFunctionsPage } from "./pages.ts";

setFlagsFromString("--expose-gc");
// Boundary: a context made after the flag has V8's `gc`.
const gc = runInNewContext("gc") as () => void;

/** How long `collect` waits for what it waits on: far past the few rounds it takes when idle. */
const COLLECT_LIMIT = 10_000;

/** The timeout of a test that collects: its wait, and time to report. */
const TIMEOUT = COLLECT_LIMIT + 5_000;

/**
 * Collects what nothing refers to, and runs what the collector found gone, until `done`, and fails
 * saying `what` it waited for if that takes `COLLECT_LIMIT`: V8 runs the callbacks of what it
 * collected on a later task of its choosing, later on a busy machine.
 */
async function collect(what: string, done: () => Promise<boolean>): Promise<void> {
	const deadline = performance.now() + COLLECT_LIMIT;
	while (!(await done())) {
		if (performance.now() > deadline) {
			throw new Error(
				`Still waiting for ${what} after ${COLLECT_LIMIT} ms of running the collector.`,
			);
		}
		await new Promise((resolve) => setTimeout(resolve, 0));
		gc();
		await new Promise((resolve) => setTimeout(resolve, 0));
	}
}

it(
	"lets the background drop the context of a handler built again, once its copy is collected",
	async () => {
		const api: Record<string, () => void> = {};
		const page = startFunctionsPage(Events, { draw: drawEvents, props: { log: [], api } });
		await page.settle();
		const before = page.asBackground(keptContexts);
		// The `.tap` element's first copy, held here so that the collector cannot take it before the checks
		// below; in a function of its own, so that no local of the test holds it once let go of.
		const held = ((): { copy?: MainThreadFunction } => {
			const tap = page.byClass("tap");
			const bound = page.engine.workletEvents.find((row) => row.element === tap)!;
			// Boundary: the engine logs what `__AddEvent` was given, the main thread's entry.
			return { copy: (bound.value as { value: { fn: MainThreadFunction } }).value.fn };
		})();
		const first = held.copy![FUNCTION_FIELDS.context]!;
		page.asBackground(() => api["next"]!());
		await page.settle();
		const rebuilt = page.asBackground(keptContexts);
		expect(rebuilt).toHaveLength(before.length + 1);
		expect(page.runtime.page.functions.sizes().contexts).toContain(first);
		expectAccounted(page, "after the handler was built again");
		delete held.copy;
		await collect("the background to let go of the first copy's context", async () => {
			await page.settle();
			return !page.asBackground(keptContexts).includes(first);
		});
		const after = page.asBackground(keptContexts);
		expect(after).toEqual(rebuilt.filter((id) => id !== first));
		expectAccounted(page, "after the collector ran");
	},
	TIMEOUT,
);

it(
	"forgets on the main thread a ref the background let go of, with the next patch",
	async () => {
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
		await collect("the main thread to forget the ref", async () => {
			page.asBackground(() => api["tick"]!());
			await page.settle();
			return page.runtime.page.functions.sizes().refs === 0;
		});
		expect(page.runtime.page.functions.sizes().refs).toBe(0);
	},
	TIMEOUT,
);
