// What the engine holds of a page's gesture detectors, checked against what the page holds.

import { expect } from "@rstest/core";

import type { LynxElement } from "../../../src/testing/index.ts";
import type { SveltePage } from "../svelte-page.ts";

/** Every element a detector was ever set on. */
function detectorElements(page: SveltePage): Set<LynxElement> {
	const elements = new Set<LynxElement>();
	for (const call of page.engine.gestureCalls) if (call.op === "set") elements.add(call.element);
	return elements;
}

/** The detectors the engine holds, on every element, on the page or not. */
export function liveDetectors(page: SveltePage): number {
	let count = 0;
	for (const element of detectorElements(page)) count += page.engine.detectors(element).length;
	return count;
}

/**
 * No detector outlives its element: the engine holds exactly the detectors the page holds, so an
 * element the page let go of has none left.
 */
export function expectNoStrayDetectors(page: SveltePage, what: string): void {
	expect(liveDetectors(page), `${what}, the detectors the engine holds`).toBe(
		page.runtime.page.functions.sizes().detectors,
	);
}
