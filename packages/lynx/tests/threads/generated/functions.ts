// The oracle of generated pages' main-thread functions: after hydration and after every step, the
// threads agree on them. Every context the background keeps is accounted for on the main thread,
// and every one the main thread holds is kept by the background; a ref one made element holds is
// that element's on the main thread, and a function ref of a made element has run and not been
// cleaned up. A made element's gesture is its detectors on the main thread, one for each plain
// gesture, of its type and with its callbacks; and the engine holds no detector the page let go of.

import { expect } from "@rstest/core";

import type { TreeNode } from "../../../src/background/renderer/node.ts";
import { pageRenderer } from "../../../src/background/renderer/page-renderer.ts";
import type { LynxElement } from "../../../src/testing/index.ts";
import {
	isGesture,
	isMainThreadFunction,
	isRefHandle,
	plainGestures,
	REF_FIELDS,
	ROOT_ID,
} from "../../../src/wire/index.ts";
import { unaccounted, unheld } from "../functions/accounting.ts";
import { expectNoStrayDetectors } from "../gestures/detectors.ts";
import type { SveltePage } from "../svelte-page.ts";

/** Every element node under `node`, through fragments. */
function* elementsUnder(node: TreeNode): Generator<TreeNode> {
	for (let child = node.first; child; child = child.next) {
		if (child.kind === "element") yield child;
		yield* elementsUnder(child);
	}
}

/** The detectors of a made element are its gesture's, as the background holds it. */
function expectGestureSet(page: SveltePage, node: TreeNode, what: string): void {
	const element = page.runtime.page.applier?.element(node.lynxId) as LynxElement | undefined;
	if (node.lynxId === 0 || !element) return;
	const value = node.attrs?.get("main-thread:gesture");
	const gestures = isGesture(value) ? plainGestures(value) : [];
	expect(
		page.engine
			.detectors(element)
			.map((detector) => [detector.type, detector.callbacks.map((callback) => callback.name)]),
		`${what}, the detectors of <${node.tag}> ${node.lynxId}`,
	).toEqual(gestures.map((gesture) => [gesture.type, Object.keys(gesture.callbacks)]));
}

/** Throws, saying what differs, unless the threads agree on the page's main-thread functions. */
export function expectFunctionsAgree(page: SveltePage, what: string): void {
	expect(unaccounted(page), `${what}, the background keeps contexts nobody holds`).toEqual([]);
	expect(unheld(page), `${what}, the main thread holds contexts the background let go of`).toEqual(
		[],
	);
	const main = page.runtime.page;
	const root = pageRenderer.nodeById(ROOT_ID);
	if (!root || !main.applier) return;
	expectNoStrayDetectors(page, what);
	const holders = new Map<number, LynxElement[]>();
	for (const node of elementsUnder(root)) {
		expectGestureSet(page, node, what);
		const value = node.attrs?.get("main-thread:ref");
		if (value == null || node.lynxId === 0) continue;
		// Boundary: the main thread's elements are the engine's.
		const element = main.applier.element(node.lynxId) as LynxElement | undefined;
		if (!element) continue;
		if (isMainThreadFunction(value)) {
			expect(
				page.engine.state(element).attrs["mt-ref"],
				`${what}, the function ref of <${node.tag}> ${node.lynxId} ran`,
			).toBe("on");
			continue;
		}
		if (!isRefHandle(value)) continue;
		const id = value[REF_FIELDS.id];
		holders.set(id, [...(holders.get(id) ?? []), element]);
	}
	for (const [id, elements] of holders) {
		// A ref two elements hold holds the last one bound: only one element's is read.
		if (elements.length !== 1) continue;
		expect(
			main.functions.refHolds(id, elements[0]!),
			`${what}, the ref ${id} holds its element on the main thread`,
		).toBe(true);
	}
}
