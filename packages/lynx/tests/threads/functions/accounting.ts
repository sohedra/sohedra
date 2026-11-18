// What the threads hold of main-thread functions' contexts, checked against each other: every
// context the background keeps is held by the main thread, named by a cell's text it keeps unread,
// or belongs to a call not answered yet.

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

/** The threads agree on the contexts kept. */
export function expectAccounted(page: SveltePage, what: string): void {
	expect(unaccounted(page), what).toEqual([]);
}
