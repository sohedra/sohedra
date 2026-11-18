// What the threads hold of main-thread functions' contexts, checked against each other: every
// context the background keeps is held by the main thread, named by a cell's text it keeps unread,
// or belongs to a call not answered yet; and every context the main thread holds is kept by the
// background.

import { expect } from "@rstest/core";

import { keptContexts } from "../../../src/background/functions/calls.ts";
import type { SveltePage } from "../svelte-page.ts";

/** The contexts the background keeps that the main thread does not account for. */
export function unaccounted(page: SveltePage, waiting: readonly number[] = []): number[] {
	const main = page.runtime.page;
	const accounted = new Set([
		...main.functions.sizes().contexts,
		...[...main.cellContexts.values()].flat(),
		...waiting,
	]);
	return page.asBackground(keptContexts).filter((id) => !accounted.has(id));
}

/**
 * The contexts the main thread holds that the background let go of: a call through one would find
 * nothing. A page written again lets go of them on both threads.
 */
export function unheld(page: SveltePage): number[] {
	const kept = new Set(page.asBackground(keptContexts));
	return page.runtime.page.functions.sizes().contexts.filter((id) => !kept.has(id));
}

/** The threads agree on the contexts kept, in both directions. */
export function expectAccounted(page: SveltePage, what: string): void {
	expect(unaccounted(page), `${what}, the background keeps what nobody holds`).toEqual([]);
	expect(unheld(page), `${what}, the main thread holds what the background let go of`).toEqual([]);
}
