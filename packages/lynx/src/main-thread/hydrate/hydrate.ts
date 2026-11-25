// Hydration: the background's first patch adopts the first frame instead of making the page again.
// The patch's rendered items (`Patch.rendered`) are matched against the drawn tree (./match.ts);
// what matches is adopted (./adopt.ts), and the rest of the patch, what the first mount's effects
// changed, is applied after as any patch is. What the first frame's main-thread functions left on an
// element hydration is not sure of stays with them: the background's bind as on a new element.
//
// A mismatch refuses hydration before anything changes; an error part way stops it. Either way the
// main thread asks the background to write the page again, and keeps the first frame on the screen
// until that patch comes.

import { MAIN_THREAD_PREFIX } from "../../wire/index.ts";
import type { HydrationMismatch, PatchItem, PropsIdDifference } from "../../wire/index.ts";
import type { Applier } from "../apply.ts";
import { mainThreadDevelopmentError } from "../catalogue.ts";
import type { EarlyEvent, Frame } from "../frame/draw.ts";
import type { DrawnNode } from "../frame/html.ts";
import type { FunctionsPage, HydratedElement } from "../functions/page.ts";
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
 * the page's new applier. The frame stops listening first. The background's main-thread functions
 * take over from the first frame's on the elements kept: what the first frame's left is carried
 * into them before anything is adopted or made, and they are bound once it is.
 */
export function hydrate(options: {
	frame: Frame;
	applier: Applier;
	items: PatchItem[];
	count: number;
	functions: FunctionsPage;
}): Hydration {
	const { frame, applier, items, count, functions } = options;
	frame.stop();
	try {
		const rendered = readRendered(items, count);
		const plan = matchFrame({
			root: frame.root,
			rendered,
			lists: frame,
			binds: (drawn) => {
				const element = frame.applier.element(drawn);
				return element !== undefined && functions.binds(element);
			},
		});
		if ("mismatch" in plan) return { kind: "refused", mismatch: plan.mismatch };
		const kept: HydratedElement[] = [];
		const carried: HydratedElement[] = [];
		for (const [id, drawn] of plan.adopt) {
			const element = frame.applier.element(drawn);
			const node = rendered.nodes.get(id);
			if (!element || !node) continue;
			const values: HydratedElement["values"] = [];
			node.attrs.forEach((value, name) => {
				if (name.startsWith(MAIN_THREAD_PREFIX)) values.push([name, value]);
			});
			if (values.length === 0 && !functions.binds(element)) continue;
			kept.push({ element, values });
			if (!plan.unsure.has(id)) carried.push({ element, values });
		}
		functions.carry(carried);
		const hydrated = adoptFrame({ frame, applier, rendered, plan });
		functions.adopt(kept);
		return { kind: "adopted", hydrated, rendered, propsIds: plan.propsIds };
	} catch (error) {
		return { kind: "failed", error };
	}
}

/**
 * Counts the early events hydration dropped, by the drawn element that heard them, for a
 * development build's warnings: one for each element, with its count.
 */
export function countDropped(): {
	dropped: (early: EarlyEvent, at: DrawnNode) => void;
	warnings: () => Error[];
} {
	const counts = new Map<DrawnNode, { event: string; count: number }>();
	return {
		dropped(early, at) {
			const seen = counts.get(at);
			if (seen) seen.count++;
			else counts.set(at, { event: early.name, count: 1 });
		},
		warnings: () =>
			[...counts].map(([at, { event, count }]) => {
				const name = at.attrs.get("class");
				const element = `<${at.tag}${typeof name === "string" && name !== "" ? ` class="${name}"` : ""}>`;
				return mainThreadDevelopmentError({
					code: "first_frame_event_dropped",
					details: { event, element, count },
				});
			}),
	};
}

/**
 * The mismatch as the background hears of it: a production build sends which kind of difference
 * and where, and none of the values, which may be the app's data.
 */
export function sentMismatch(mismatch: HydrationMismatch, development: boolean): HydrationMismatch {
	return development ? mismatch : { kind: mismatch.kind, element: mismatch.element };
}
