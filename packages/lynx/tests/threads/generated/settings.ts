// How many pages a generated test tries, and from which seed: a few pages from a fixed seed in the
// suite, so `pnpm test` is quick and the same each time; more on demand, as
// `GENERATED_RUNS=500 GENERATED_SEED=7 pnpm -F @sohedra/lynx test tests/threads/generated`. A
// failure prints its property's seed and path: `GENERATED_SEED` and `GENERATED_PATH` with that
// test's name (`-t`) run that one page again.

import fc from "fast-check";

import { readGlobal } from "../../../src/testing/globals.ts";
import type { PageSources } from "./compile.ts";
import { describeSources } from "./source.ts";

const variables = (readGlobal("process") as { env: Record<string, string | undefined> }).env;

/** The pages each property tries. */
export const RUNS: number = Number(variables["GENERATED_RUNS"] ?? 20);

/** The seed of the first property; each property adds its own number, so none tries another's pages. */
export const SEED: number = Number(variables["GENERATED_SEED"] ?? 2026);

const PATH = variables["GENERATED_PATH"];

/**
 * The time a page may take. A page of the costliest property took 165 ms on average, 243 ms on a
 * busier machine and 411 ms from seed 7, at 300 runs with the four properties running at once; a
 * second is over twice the most.
 */
const PAGE_BUDGET = 1_000;

/** How many pages a property tries, and the time each may take. */
export interface Pages {
	runs: number;
	each: number;
}

/** The pages of a property that renders them. */
const RENDERED: Pages = { runs: RUNS, each: PAGE_BUDGET };

/**
 * How long a property may run: its pages, and 30 s to shrink. It stops itself then, and fails: a
 * property that timed out and ran on would share the next test's globals.
 */
const budget = ({ runs, each }: Pages): number => 30_000 + runs * each;

/** The timeout of a generated test that checks `pages`: its property's budget, and time to report. */
export function timeoutOf(pages: Pages = RENDERED): number {
	return budget(pages) + 15_000;
}

/** The timeout of a generated test that renders its pages. */
export const TIMEOUT: number = timeoutOf();

/** Checks `property` from `SEED + offset` on `pages`, within their budget. */
export async function check<T>(
	property: fc.IAsyncPropertyWithHooks<T>,
	offset: number,
	pages: Pages = RENDERED,
): Promise<void> {
	await fc.assert(property, {
		seed: SEED + offset,
		numRuns: pages.runs,
		...(PATH !== undefined && { path: PATH }),
		interruptAfterTimeLimit: budget(pages),
		markInterruptAsFailure: true,
		includeErrorInReport: true,
	});
}

/** Runs `body`; what it throws says which page it was about, with what happened to it. */
export async function about<T>(
	sources: PageSources,
	what: unknown,
	body: () => Promise<T>,
): Promise<T> {
	try {
		return await body();
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		throw new Error(
			`${message}\n\nThe page:\n${describeSources(sources)}\nWith:\n${JSON.stringify(what, null, 2)}`,
			{ cause: error },
		);
	}
}
