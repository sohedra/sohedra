// The oracles, as properties over generated pages and what happens to them.

import { expect } from "@rstest/core";
import fc from "fast-check";

import { compilePage } from "./compile.ts";
import type { CompiledBoth } from "./compile.ts";
import { pageModel } from "./grammar.ts";
import type { PageModel, PageState } from "./grammar.ts";
import { apply, earlyStep, rewrote, run, startGenerated, step, wroteIds } from "./run.ts";
import type { GeneratedPage, StartOptions, Step } from "./run.ts";
import { about } from "./settings.ts";
import { pageSources } from "./source.ts";
import { backgroundTree, engineTree, expectSameTree } from "./trees.ts";

/** Throws, with each error's message, when the page reported any. */
function expectNoErrors(errors: readonly unknown[], when: string): void {
	if (errors.length === 0) return;
	const messages = errors.map((error) => (error instanceof Error ? error.message : String(error)));
	throw new Error(`${when}, the page reported:\n${messages.join("\n---\n")}`);
}

/** What a failure says about the page besides its source. */
const described = (model: PageModel): Record<string, unknown> => ({
	data: model.data,
	fromTemplate: model.fromTemplate,
	production: model.production,
});

/** Compiles the page and starts it as `model` says, with `options`. */
async function start(
	model: PageModel,
	options: Omit<StartOptions, "compiled" | "data">,
): Promise<{ compiled: CompiledBoth; running: GeneratedPage }> {
	const compiled = await compilePage(pageSources(model), { production: model.production });
	const running = startGenerated({
		...options,
		compiled,
		data: model.data,
		fromTemplate: model.fromTemplate,
	});
	return { compiled, running };
}

/**
 * The first frame the main thread draws from the page's data is what the background renders from
 * the same data, where `background` is false: the same elements, attributes and texts, in order.
 * Its lists are read as their items' keys, or as every cell, which Lynx then holds at hydration.
 */
export const firstFrameProperty: fc.IAsyncPropertyWithHooks<[PageModel, boolean]> =
	fc.asyncProperty(pageModel, fc.boolean(), async (model, cells) => {
		await about(pageSources(model), { ...described(model), cells }, async () => {
			// The frame binds no events until the background's patch: they are compared after it.
			const reading = { lists: cells ? "cells" : "keys", events: false } as const;
			const { compiled, running: reference } = await start(model, {
				firstFrame: false,
				background: false,
			});
			await reference.page.settle();
			expectNoErrors(reference.page.errors, "With no first frame");
			const rendered = backgroundTree(reading);
			const { page } = startGenerated({
				compiled,
				data: model.data,
				fromTemplate: model.fromTemplate,
				firstFrame: true,
			});
			expectNoErrors(page.errors, "Drawing the first frame");
			expectSameTree(engineTree(page.engine, reading), rendered, "The first frame shows");
		});
	});

/** The ids of `$props.id()` that are the page's own, as `Name id`: `lynx-s1`… */
const pageIds = (ids: readonly string[]): string[] => ids.filter((id) => / lynx-s\d+$/.test(id));

/**
 * The background gives each component the `$props.id()` the first frame gave it, but in a branch
 * only one thread renders. Its first patch hydrates the first frame with no mismatch reported, no
 * page written again and no id written over, and Lynx then shows what the background rendered.
 * Before that patch, Lynx may ask for cells and hand them back, the user may tap, and the host may
 * update the data or reload.
 */
export const hydrationProperty: fc.IAsyncPropertyWithHooks<[PageModel, Step[]]> = fc.asyncProperty(
	pageModel,
	fc.array(earlyStep, { maxLength: 3 }),
	async (model, early) => {
		await about(pageSources(model), { ...described(model), early }, async () => {
			const { running } = await start(model, { firstFrame: true });
			// The page's own ids, those of no branch only one thread renders, are the first frame's.
			expect(pageIds(running.ids.background), "The background's ids of $props.id()").toEqual(
				pageIds(running.ids.frame),
			);
			for (const done of early) apply(running, done);
			await running.page.settle();
			expectNoErrors(running.page.errors, "At hydration");
			expect(rewrote(running.page), "The page was written again").toBe(false);
			expect(wroteIds(running.page), "Hydration wrote ids of $props.id() over").toBe(false);
			expectSameTree(engineTree(running.page.engine), backgroundTree());
		});
	},
);

/**
 * The ids of `$props.id()` count on across a page's renders, and a component a branch only one
 * thread renders makes later takes the page's: a fresh page counts from the first.
 */
const withoutIds = (tree: string[]): string[] =>
	tree.map((line) => line.replace(/lynx-[sbm]\d+/g, "lynx-#"));

/**
 * After each change of the state on the background, tap, cell Lynx asks for or hands back, data
 * update and reload, Lynx shows what the background rendered, and nothing is reported: with a
 * first frame, or with none, when the background builds the page alone. And what the background
 * rendered after each step is what a page started from that step's state renders, so the
 * renderer's updates are checked against a mount.
 */
export function updatesProperty(
	firstFrame: boolean,
): fc.IAsyncPropertyWithHooks<[PageModel, Step[], Step[]]> {
	return fc.asyncProperty(
		pageModel,
		fc.array(earlyStep, { maxLength: 2 }),
		fc.array(step, { minLength: 1, maxLength: 6 }),
		async (model, early, steps) => {
			await about(pageSources(model), { ...described(model), early, steps }, async () => {
				const { compiled, running } = await start(model, { firstFrame });
				for (const done of early) apply(running, done);
				await running.page.settle();
				// What the background rendered after each step, by the state it rendered.
				const renders = new Map<string, { after: number; tree: string[] }[]>();
				for (const [index, done] of steps.entries()) {
					await run(running, done);
					await running.page.settle();
					const after = `After ${index + 1} of the steps`;
					expectNoErrors(running.page.errors, after);
					const rendered = backgroundTree();
					expectSameTree(engineTree(running.page.engine), rendered, `${after}, Lynx shows`);
					const state = running.page.asBackground(() => JSON.stringify(running.handles.st));
					renders.set(state, [...(renders.get(state) ?? []), { after: index + 1, tree: rendered }]);
				}
				for (const [state, trees] of renders) {
					const fresh = startGenerated({
						compiled,
						data: JSON.parse(state) as PageState,
						firstFrame: false,
					});
					await fresh.page.settle();
					expectNoErrors(fresh.page.errors, "A page started from a step's state");
					const mounted = withoutIds(backgroundTree());
					for (const { after, tree } of trees) {
						expectSameTree(
							withoutIds(tree),
							mounted,
							`After ${after} of the steps, the background updated the page to`,
						);
					}
				}
			});
		},
	);
}
