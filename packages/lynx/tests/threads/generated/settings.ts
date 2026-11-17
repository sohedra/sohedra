// How many pages a generated test tries, and from which seed: a fixed seed and a few runs in the
// suite, so `pnpm test` is quick and the same each time; more on demand, as
// `GENERATED_RUNS=500 GENERATED_SEED=7 pnpm -F @sohedra/lynx test tests/threads/generated`.

import fc from "fast-check";

import { readGlobal } from "../../../src/testing/globals.ts";
import type { PageSources } from "./compile.ts";
import { describeSources } from "./source.ts";

const variables = (readGlobal("process") as { env: Record<string, string | undefined> }).env;

/** The runs of each property. */
export const RUNS: number = Number(variables["GENERATED_RUNS"] ?? 20);

/** The seed of every property. */
export const SEED: number = Number(variables["GENERATED_SEED"] ?? 2026);

/** Checks `property` from the seed, `RUNS` times. */
export async function check<T>(property: fc.IAsyncPropertyWithHooks<T>): Promise<void> {
	await fc.assert(property, { seed: SEED, numRuns: RUNS, includeErrorInReport: true });
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
