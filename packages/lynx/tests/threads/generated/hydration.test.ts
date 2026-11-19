// Generated pages, drawn as a first frame and hydrated.

import { describe, it } from "@rstest/core";
import fc from "fast-check";

import type { ComponentModel, PageModel } from "./grammar.ts";
import { THREAD_TESTS } from "./markup.ts";
import type { MarkupNode } from "./markup.ts";
import { firstFrameProperty, hydrationProperty } from "./properties.ts";
import type { Step } from "./run.ts";
import { check, TIMEOUT } from "./settings.ts";

describe("a generated page's first frame", () => {
	it(
		"is what the background renders from the same data",
		async () => {
			await check(firstFrameProperty, 0);
		},
		TIMEOUT,
	);

	it(
		"is hydrated with no mismatch and with the first frame's ids, and shows what the background rendered",
		async () => {
			await check(hydrationProperty, 1);
		},
		TIMEOUT,
	);
});

/** An element whose main-thread tap handler calls a background function. */
const tapped: MarkupNode = {
	kind: "element",
	tag: "text",
	attributes: ["main-thread:ontap={mtTap}"],
	children: [],
};

/** The root component, holding `body`, with `snippets`. */
const root = (body: MarkupNode[], snippets: ComponentModel["snippets"] = []): ComponentModel => ({
	name: "App",
	context: "block",
	lists: 0,
	uid: false,
	snippets,
	body,
});

/** A page of `components`, the root last. */
const page = (...components: ComponentModel[]): PageModel => ({
	components,
	data: { s0: "", s1: "", s2: "", b0: false, b1: false, n0: 0, a0: [], a1: [], t0: "view" },
	fromTemplate: [],
	indented: false,
	production: false,
});

/** Checks the hydration property on these pages, each with its steps before hydration. */
async function checkPages(pages: [PageModel, Step[]][]): Promise<void> {
	await fc.assert(hydrationProperty, { examples: pages, numRuns: pages.length });
}

describe("a generated page's first frame, tapped before hydration", () => {
	const taps: Step[] = [
		{ kind: "tap", pick: 0 },
		{ kind: "tap", pick: 1 },
	];

	it("is tapped only where both threads render", async () => {
		const child: ComponentModel = { ...root([tapped]), name: "Child0" };
		await checkPages([
			// The other branch holds nothing: hydration would adopt an element like it.
			...THREAD_TESTS.flatMap((condition): [PageModel, Step[]][] => [
				[
					page(root([tapped, { kind: "if", condition, consequent: [tapped], otherwise: [] }])),
					taps,
				],
				[
					page(root([tapped, { kind: "if", condition, consequent: [], otherwise: [tapped] }])),
					taps,
				],
			]),
			[
				page(
					child,
					root([
						tapped,
						{
							kind: "if",
							condition: "!background",
							consequent: [{ kind: "component", name: "Child0", label: '"a"', cssVariable: false }],
							otherwise: undefined,
						},
					]),
				),
				taps,
			],
			[
				page(
					root(
						[
							tapped,
							{
								kind: "if",
								condition: "mainThread",
								consequent: [{ kind: "render", snippet: "piece0", argument: '"a"' }],
								otherwise: undefined,
							},
						],
						[{ name: "piece0", context: "block", lists: 0, body: [tapped] }],
					),
				),
				taps,
			],
		]);
	});
});
