// The oracles, as properties over generated pages and what happens to them.

import { expect } from "@rstest/core";
import fc from "fast-check";

import { compilePage } from "./compile.ts";
import { pageModel } from "./grammar.ts";
import type { PageModel } from "./grammar.ts";
import { apply, earlyStep, rewrote, startGenerated, step } from "./run.ts";
import type { Step } from "./run.ts";
import { about } from "./settings.ts";
import { pageSources } from "./source.ts";
import { backgroundTree, engineTree, expectSameTree } from "./trees.ts";

/** Throws, with each error's message, when the page reported any. */
function expectNoErrors(errors: readonly unknown[], when: string): void {
	if (errors.length === 0) return;
	const messages = errors.map((error) => (error instanceof Error ? error.message : String(error)));
	throw new Error(`${when}, the page reported:\n${messages.join("\n---\n")}`);
}

/**
 * The first frame the main thread draws from the page's data is what the background renders from
 * the same data, where `background` is false: the same elements, attributes and texts, in order.
 * Its lists are read as their items' keys, or as every cell, which Lynx then holds at hydration.
 */
export const firstFrameProperty: fc.IAsyncPropertyWithHooks<[PageModel, boolean]> =
	fc.asyncProperty(pageModel, fc.boolean(), async (model, cells) => {
		const sources = pageSources(model);
		await about(sources, { data: model.data, cells }, async () => {
			const compiled = await compilePage(sources);
			// The frame binds no events until the background's patch: they are compared after it.
			const reading = { lists: cells ? "cells" : "keys", events: false } as const;
			const reference = startGenerated({
				compiled,
				data: model.data,
				firstFrame: false,
				background: false,
			});
			await reference.page.settle();
			expectNoErrors(reference.page.errors, "With no first frame");
			const rendered = backgroundTree(reading);
			const { page } = startGenerated({ compiled, data: model.data, firstFrame: true });
			expectNoErrors(page.errors, "Drawing the first frame");
			expectSameTree(engineTree(page.engine, reading), rendered, "The first frame shows");
		});
	});

/**
 * The background's first patch hydrates the first frame with no mismatch reported and no page
 * written again, and Lynx then shows what the background rendered. Before that patch, Lynx may
 * ask for cells and hand them back, the user may tap, and the host may update the data or reload.
 */
export const hydrationProperty: fc.IAsyncPropertyWithHooks<[PageModel, Step[]]> = fc.asyncProperty(
	pageModel,
	fc.array(earlyStep, { maxLength: 3 }),
	async (model, early) => {
		const sources = pageSources(model);
		await about(sources, { data: model.data, early }, async () => {
			const compiled = await compilePage(sources);
			const running = startGenerated({ compiled, data: model.data, firstFrame: true });
			for (const done of early) apply(running, done);
			await running.page.settle();
			expectNoErrors(running.page.errors, "At hydration");
			expect(rewrote(running.page), "The page was written again").toBe(false);
			expectSameTree(engineTree(running.page.engine), backgroundTree());
		});
	},
);

/**
 * After each change of the state on the background, tap, cell Lynx asks for or hands back, data
 * update and reload, Lynx shows what the background rendered, and nothing is reported: with a
 * first frame, or with none, when the background builds the page alone.
 */
export function updatesProperty(
	firstFrame: boolean,
): fc.IAsyncPropertyWithHooks<[PageModel, Step[], Step[]]> {
	return fc.asyncProperty(
		pageModel,
		fc.array(earlyStep, { maxLength: 2 }),
		fc.array(step, { minLength: 1, maxLength: 6 }),
		async (model, early, steps) => {
			const sources = pageSources(model);
			await about(sources, { data: model.data, early, steps }, async () => {
				const compiled = await compilePage(sources);
				const running = startGenerated({ compiled, data: model.data, firstFrame });
				for (const done of early) apply(running, done);
				await running.page.settle();
				for (const [index, done] of steps.entries()) {
					apply(running, done);
					await running.page.settle();
					const after = `After ${index + 1} of the steps`;
					expectNoErrors(running.page.errors, after);
					expectSameTree(engineTree(running.page.engine), backgroundTree(), `${after}, Lynx shows`);
				}
			});
		},
	);
}
