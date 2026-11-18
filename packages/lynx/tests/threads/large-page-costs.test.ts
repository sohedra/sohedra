// What a large static page with no list costs the main thread's first frame, counted in the steps
// that cost most on the main thread's engine, which runs without a JIT: regex matches, map and set
// calls, and iterations of a map or an array, each of which makes an object for every step. The
// stages are the server's render of the markup, its reading up to the first element made, and the
// drawing of the elements; the engine's own work is not counted. A count, unlike a time, is the
// same on every machine. A change that counts more must raise a budget here, on purpose.

import { describe, expect, it } from "@rstest/core";

import { createCodeStyles } from "../../src/main-thread/code-styles.ts";
import { createFlattening } from "../../src/main-thread/flatten.ts";
import { drawFrame } from "../../src/main-thread/frame/draw.ts";
import { createFunctionsPage } from "../../src/main-thread/functions/page.ts";
import { createInputNumbers } from "../../src/main-thread/inputs.ts";
import { installGlobals, readGlobal } from "../../src/testing/globals.ts";
import { startTestPage } from "../../src/testing/index.ts";
import { FIRST_FRAME_GLOBAL } from "../../src/wire/index.ts";
import drawStaticCards from "../fixtures/threads/StaticCards.svelte?first-frame";

/** What each stage counts, per node of the page (an element or a text). */
interface Counts {
	matches: number;
	lookups: number;
	mapIterations: number;
	arrayIterations: number;
}

type Owners = [object, PropertyKey][];

const KINDS: Record<keyof Counts, Owners> = {
	matches: [[RegExp.prototype, "exec"]],
	lookups: [Map.prototype, Set.prototype].flatMap((owner) =>
		["get", "set", "has", "add", "delete"].map((name): [object, PropertyKey] => [owner, name]),
	),
	mapIterations: [
		[Map.prototype, Symbol.iterator],
		[Map.prototype, "entries"],
		[Map.prototype, "keys"],
		[Map.prototype, "values"],
	],
	arrayIterations: [[Array.prototype, Symbol.iterator]],
};

/**
 * The budgets, per node, as measured, with a little headroom. The server's render escapes with a
 * regex (Svelte's). Reading the markup matches one regex per element (its tag), looks up a few
 * times per node, and iterates no map and next to no array; drawing iterates nothing. The page
 * around the cards adds a few of each.
 */
const BUDGET: { render: Counts; read: Counts; draw: Counts } = {
	render: { matches: 0.25, lookups: 0, mapIterations: 0, arrayIterations: 0 },
	read: { matches: 0.72, lookups: 2.7, mapIterations: 0, arrayIterations: 0.05 },
	draw: { matches: 0, lookups: 7.1, mapIterations: 0, arrayIterations: 0 },
};
const AROUND = 20;

/** No counts. */
const none = (): Counts => ({ matches: 0, lookups: 0, mapIterations: 0, arrayIterations: 0 });

/** Counts calls of each kind's methods into `counts` while `run` runs, and not while `paused()`. */
function counting(run: () => void, paused: () => boolean, counts: Counts = none()): Counts {
	const restores: (() => void)[] = [];
	for (const [kind, owners] of Object.entries(KINDS) as [keyof Counts, Owners][]) {
		for (const [owner, name] of owners) {
			// Boundary: any method of a built-in, called as it was.
			const original = Reflect.get(owner, name) as (...args: unknown[]) => unknown;
			Reflect.set(owner, name, function (this: unknown, ...args: unknown[]) {
				if (!paused()) counts[kind]++;
				return Reflect.apply(original, this, args);
			});
			restores.push(() => Reflect.set(owner, name, original));
		}
	}
	try {
		run();
	} finally {
		for (const restore of restores) restore();
	}
	return counts;
}

/** `after` less `before`, kind by kind. */
const less = (after: Counts, before: Counts): Counts => ({
	matches: after.matches - before.matches,
	lookups: after.lookups - before.lookups,
	mapIterations: after.mapIterations - before.mapIterations,
	arrayIterations: after.arrayIterations - before.arrayIterations,
});

describe("a static page of 200 cards", () => {
	it("draws its first frame within its budget", () => {
		drawStaticCards({ count: 200 });
		const write = readGlobal(FIRST_FRAME_GLOBAL) as (data: object) => string;
		let markup = "";
		const render = counting(
			() => (markup = write({})),
			() => false,
		);

		// A page with no runtime: the frame is drawn below, on its own.
		const page = startTestPage({
			mainThread: () => void installGlobals({ renderPage: () => undefined }),
		});
		const engine = page.engine;
		let inEngine = 0;
		let read: Counts | undefined;
		const total = none();
		page.asMainThread(() => {
			// The engine's functions are not the binding's: what they do is not counted. The counts
			// when the first element is made are what reading the markup cost.
			const wrapped: Record<string, unknown> = {};
			for (const [name, fn] of Object.entries(engine.functions)) {
				wrapped[name] = (...args: unknown[]) => {
					if (read === undefined && name.startsWith("__Create") && name !== "__CreatePage")
						read = { ...total };
					inEngine++;
					try {
						return (fn as (...args: unknown[]) => unknown)(...args);
					} finally {
						inEngine--;
					}
				};
			}
			const restore = installGlobals(wrapped);
			try {
				const styles = createCodeStyles();
				const flattening = createFlattening();
				const functions = createFunctionsPage({
					styles,
					flattening,
					send: () => undefined,
					report: (error) => void page.errors.push(error),
					flush: () => undefined,
					afterLayout: () => undefined,
					soon: () => undefined,
					nextTurn: () => false,
					idOf: () => undefined,
				});
				const element = engine.functions.__CreatePage("0", 0);
				counting(
					() =>
						void drawFrame({
							page: element,
							html: markup,
							report: (error) => void page.errors.push(error),
							styles,
							flattening,
							inputs: createInputNumbers(),
							functions,
							settle: () => undefined,
						}),
					() => inEngine > 0,
					total,
				);
			} finally {
				restore();
			}
		});
		expect(page.errors).toEqual([]);
		const nodes = engine.all().length - 1;
		expect(nodes).toBe(4204);
		const stages = { render, read: read!, draw: less(total, read!) };
		const over: string[] = [];
		for (const stage of ["render", "read", "draw"] as const)
			for (const kind of Object.keys(KINDS) as (keyof Counts)[]) {
				const budget = BUDGET[stage][kind] * nodes + AROUND;
				if (stages[stage][kind] > budget)
					over.push(`${stage}: ${stages[stage][kind]} ${kind}, over ${Math.floor(budget)}`);
			}
		expect(over).toEqual([]);
	});
});
