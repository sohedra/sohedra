// Hydration: the background's first patch adopts the first frame instead of making the page again.
// The patch's rendered items (`Patch.rendered`) are matched against the drawn tree (./match.ts);
// what matches is adopted (./adopt.ts), and the rest of the patch, what the first mount's effects
// changed, is applied after as any patch is.
//
// A mismatch refuses hydration before anything changes; an error part way stops it. Either way the
// main thread asks the background to write the page again, and keeps the first frame on the screen
// until that patch comes.

import type { HydrationMismatch, PatchItem, PropsIdDifference } from "../../wire/index.ts";
import type { Applier } from "../apply.ts";
import type { Frame } from "../frame/draw.ts";
import { adoptFrame } from "./adopt.ts";
import type { Hydrated } from "./adopt.ts";
import { matchFrame } from "./match.ts";
import { readRendered } from "./rendered.ts";
import type { Rendered } from "./rendered.ts";

export { replayEarly } from "./adopt.ts";
export type { Hydrated, Replay } from "./adopt.ts";

/** How hydration ended. */
export type Hydration =
	| { kind: "adopted"; hydrated: Hydrated; rendered: Rendered; propsIds: PropsIdDifference[] }
	| { kind: "refused"; mismatch: HydrationMismatch }
	| { kind: "failed"; error: unknown };

/**
 * Hydrates `frame` from the first `count` items of the background's first patch, into `applier`,
 * the page's new applier. The frame stops listening first.
 */
export function hydrate(options: {
	frame: Frame;
	applier: Applier;
	items: PatchItem[];
	count: number;
}): Hydration {
	const { frame, applier, items, count } = options;
	frame.stop();
	try {
		const rendered = readRendered(items, count);
		const plan = matchFrame({ root: frame.root, rendered, lists: frame });
		if ("mismatch" in plan) return { kind: "refused", mismatch: plan.mismatch };
		const hydrated = adoptFrame({ frame, applier, rendered, plan });
		return { kind: "adopted", hydrated, rendered, propsIds: plan.propsIds };
	} catch (error) {
		return { kind: "failed", error };
	}
}

/**
 * The mismatch as the background hears of it: a production build sends which kind of difference
 * and where, and none of the values, which may be the app's data.
 */
export function sentMismatch(mismatch: HydrationMismatch, development: boolean): HydrationMismatch {
	return development ? mismatch : { kind: mismatch.kind, node: mismatch.node };
}
