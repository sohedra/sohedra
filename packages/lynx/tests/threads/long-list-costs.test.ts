// What drawing and starting a long list costs, counted in the steps that cost most on Lynx's
// engines, which run without a JIT: regex matches on the main thread's scan of a list's items, and
// map and set calls and map iterations there and on the background's start. A count, unlike a time,
// is the same on every machine. A change that counts more must raise a budget here, on purpose.

import { describe, expect, it } from "@rstest/core";

import { mountPage } from "../../src/background/index.ts";
import { cellInfo, parsePage } from "../../src/main-thread/frame/html.ts";
import type { DrawnChild, DrawnNode } from "../../src/main-thread/frame/html.ts";
import { readGlobal } from "../../src/testing/globals.ts";
import { startTestPage } from "../../src/testing/index.ts";
import type { BackgroundLynx } from "../../src/testing/index.ts";
import { FIRST_FRAME_GLOBAL, ROOT_ID } from "../../src/wire/index.ts";
import LongFeed from "../fixtures/threads/LongFeed.svelte";
import drawLongFeed from "../fixtures/threads/LongFeed.svelte?first-frame";
import { startUp } from "./svelte-page.ts";

/**
 * The budgets, as measured: the scan matches one regex per item (its tag) and a few for the page
 * around the list, and iterates no map's entries (each a call per entry, and an array for each).
 */
const SCAN = { matchesPerItem: 1, matchesAround: 10, iterations: 0 };

/**
 * The background's start to its first patch, as measured per row for each shape, Svelte's calls
 * and the binding's counted together: map and set calls, and map iterations (a row written as a
 * component spreads its props). Each budget is the measure with the same headroom. The calls guard
 * against regressions; they are not the engine's cost model (a version of the splitter with fewer
 * calls ran slower there). A Svelte upgrade may move Svelte's share.
 */
const MOUNT = {
	plain: { lookupsPerRow: 283, iterationsPerRow: 0 },
	row: { lookupsPerRow: 298, iterationsPerRow: 2 },
};
const HEADROOM = 1.04;
/** What the page around the list counts, once. */
const AROUND = { lookups: 100, iterations: 10 };

const MAP_AND_SET: [object, PropertyKey][] = [Map.prototype, Set.prototype].flatMap((owner) =>
	["get", "set", "has", "add", "delete"]
		.filter((name) => name in owner)
		.map((name): [object, PropertyKey] => [owner, name]),
);

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

		it("starts on the background within its budget", () => {
			const start = (owners: [object, PropertyKey][]) => {
				let calls = 0;
				let sent = 0;
				startTestPage({
					background: () => {
						startUp();
						const native = (readGlobal("lynx") as BackgroundLynx).getNativeApp();
						const send = native.callLepusMethod.bind(native);
						native.callLepusMethod = (name, params, callback) => {
							sent++;
							send(name, params, callback);
						};
						calls = counting(owners, () => {
							mountPage(LongFeed, { props: () => ({ count, shape }) });
						}).calls;
					},
				});
				expect(sent).toBe(1);
				return calls;
			};
			const lookups = start(MAP_AND_SET);
			const iterations = start([
				[Map.prototype, Symbol.iterator],
				[Map.prototype, "entries"],
			]);
			const budget = MOUNT[shape];
			expect(lookups).toBeLessThanOrEqual(budget.lookupsPerRow * HEADROOM * count + AROUND.lookups);
			expect(iterations).toBeLessThanOrEqual(
				budget.iterationsPerRow * HEADROOM * count + AROUND.iterations,
			);
		});
	});
});
