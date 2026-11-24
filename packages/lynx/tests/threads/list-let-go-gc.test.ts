// A let-go row's elements are let go of: the main thread keeps no reference to any of them, so
// once the engine forgets them too, they are collected. On a device, Lynx frees an element's views
// when the element object goes.

import { setFlagsFromString } from "node:v8";
import { runInNewContext } from "node:vm";

import { expect, it } from "@rstest/core";

import type { LynxElement } from "../../src/testing/index.ts";
import { rowsLetGo } from "./rows-let-go.ts";

setFlagsFromString("--expose-gc");
// Boundary: a context made after the flag has V8's `gc`.
const gc = runInNewContext("gc") as () => void;

/** Collects what nothing refers to: a `WeakRef`'s target stays until its task ends. */
async function collect(): Promise<void> {
	for (let round = 0; round < 3; round++) {
		await new Promise((resolve) => setTimeout(resolve, 0));
		gc();
	}
}

it("keeps no reference to a let-go row's elements", async () => {
	const { page, through, rowsOnPage } = await rowsLetGo();
	const refs: WeakRef<LynxElement>[] = [];
	const uids: number[] = [];
	// In a function of its own, so that no local of the test holds an element.
	(() => {
		for (const id of [1, 2, 3]) {
			const cell = page.byClass(`row-${id}`).parentNode as LynxElement;
			uids.push(page.engine.state(cell).uid);
			for (const element of page.engine.all(cell)) refs.push(new WeakRef(element));
		}
	})();
	await through(0, 31);
	expect(rowsOnPage()).not.toContain(1);
	for (const uid of uids) page.engine.forget(uid);
	await collect();
	expect(refs.length).toBeGreaterThan(10);
	expect(refs.filter((ref) => ref.deref() !== undefined)).toEqual([]);
	expect(page.errors).toEqual([]);
});
