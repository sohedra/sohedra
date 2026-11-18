// What drawing and starting a long list costs, counted in the steps that cost most on Lynx's
// engines, which run without a JIT: regex matches and map iterations on the main thread's scan of a
// list's items. A count, unlike a time, is the same on every machine. A change that counts more must
// raise a budget here, on purpose.

import { describe, expect, it } from "@rstest/core";

import { cellInfo, parsePage } from "../../src/main-thread/frame/html.ts";
import type { DrawnChild, DrawnNode } from "../../src/main-thread/frame/html.ts";
import { readGlobal } from "../../src/testing/globals.ts";
import { FIRST_FRAME_GLOBAL, ROOT_ID } from "../../src/wire/index.ts";
import drawLongFeed from "../fixtures/threads/LongFeed.svelte?first-frame";

/**
 * The budgets, as measured: the scan matches one regex per item (its tag) and a few for the page
 * around the list, and iterates no map's entries (each a call per entry, and an array for each).
 */
const SCAN = { matchesPerItem: 1, matchesAround: 10, iterations: 0 };

/** Counts the calls of each method, by its owner and name, while `run` runs. */
function counting<T>(owners: [object, PropertyKey][], run: () => T): { result: T; calls: number } {
	let calls = 0;
	const originals = owners.map(([owner, name]) => {
		// Boundary: any method of a built-in, called as it was.
		const original = Reflect.get(owner, name) as (...args: unknown[]) => unknown;
		Reflect.set(owner, name, function (this: unknown, ...args: unknown[]) {
			calls++;
			return Reflect.apply(original, this, args);
		});
		return () => Reflect.set(owner, name, original);
	});
	try {
		return { result: run(), calls };
	} finally {
		for (const restore of originals) restore();
	}
}

/** The first list of a drawn tree. */
function listOf(children: DrawnChild[]): DrawnNode | undefined {
	for (const child of children) {
		const found =
			"block" in child ? listOf(child.children) : child.cells ? child : listOf(child.children);
		if (found) return found;
	}
	return undefined;
}

describe.each([1000, 5000])("a list of %i rows", (count) => {
	describe.each(["plain", "row"] as const)("written as %s", (shape) => {
		it("is scanned within its budget", () => {
			drawLongFeed({ count, shape });
			const markup = (readGlobal(FIRST_FRAME_GLOBAL) as (data: object) => string)({});
			let next = ROOT_ID;
			const scan = () => {
				const page = parsePage(markup, ROOT_ID, () => ++next);
				const list = listOf(page.children)!;
				for (const cell of list.cells!) cellInfo(cell);
				return list;
			};
			const matches = counting([[RegExp.prototype, "exec"]], scan);
			const iterations = counting(
				[
					[Map.prototype, Symbol.iterator],
					[Map.prototype, "entries"],
				],
				scan,
			);
			expect(matches.result.cells).toHaveLength(count);
			expect(matches.calls).toBeLessThanOrEqual(SCAN.matchesPerItem * count + SCAN.matchesAround);
			expect(iterations.calls).toBeLessThanOrEqual(SCAN.iterations);
		});
	});
});
