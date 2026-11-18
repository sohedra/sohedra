// What the background's compiled components import as Svelte's client runtime: the build points
// `svelte/internal/client` here. Svelte's own, except `$props.id()`, and with the wrapper of a
// branch only one thread renders and the count of a list's first screen.

import { PROPS_ID_PREFIX } from "../../wire/index.ts";
import { listAttributes, startingScreens } from "./first-screen.ts";
import type { ListAttributes } from "./first-screen.ts";
import { svelteSlot } from "./globals.ts";
import { branchId, newBranchCounts } from "./thread-branches.ts";

export { ThreadBranch } from "./thread-branches.ts";

// @ts-expect-error -- Svelte publishes no types for its internal modules.
export * from "svelte/internal/client";

/** The shared count when this page started: its ids are counted from there. */
let base = 1;

/** The ids this page's branches that only one thread renders have given. */
let branches = newBranchCounts();

/**
 * `$props.id()`: the same ids as Svelte's server gives the first frame, `lynx-s1`, `lynx-s2`…, in
 * the order the page's components render. Svelte's client gives `c1`… unless it hydrates, which a
 * custom renderer does not. The count is Svelte's own on the global object, shared by every runtime
 * in the realm (a lazy bundle's copy of this module, another page of a Lynx group), and is never set
 * back: each page counts from the base it took when it started. A component rendered as a branch
 * only one thread renders is drawn takes the branch's own id instead (`lynx-b1`…), and leaves the
 * count alone.
 */
export function props_id(): string {
	const inBranch = branchId(branches);
	if (inBranch !== undefined) return inBranch;
	const slot = svelteSlot();
	const count = slot.uid ?? 1;
	slot.uid = count + 1;
	return `${PROPS_ID_PREFIX}-s${count - base + 1}`;
}

/** A page starts: its ids start again from the first, as the first frame's do. */
export function startPropsIds(): void {
	const slot = svelteSlot();
	base = slot.uid ??= 1;
	branches = newBranchCounts();
}

/** The background's count of a list's first screen, while the page starts (./first-screen.ts). */
export function firstScreenList(read?: () => ListAttributes, where?: string): undefined {
	startingScreens()?.open(listAttributes(read), where);
	return undefined;
}

/** The list whose rows the background counts ends. */
export function firstScreenEnd(): undefined {
	startingScreens()?.close();
	return undefined;
}

/** Counts a row with no state of its own (a deferred row counts as it renders: `deferredRow`). */
export function firstScreenRow(fullSpan?: unknown): undefined {
	startingScreens()?.row(fullSpan);
	return undefined;
}
