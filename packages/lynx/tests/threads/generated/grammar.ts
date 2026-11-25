// The grammar of generated pages: small Svelte pages built from what the binding supports, as
// fast-check arbitraries, so that a failing page shrinks to the smallest one that still fails.
//
// A page is a root component, `App.svelte`, and up to two children. `App` owns the page's state,
// `st`, made from the page's data, and passes it to every child; each child also takes a `label`.
// What a page holds:
//
//   - elements: `<view>`, `<text>` (inline `<text>` and texts inside it), `<image>`, `<list>` with
//     `<list-item>`s, one list inside a list's item, and a list long enough that a scroll releases
//     rows, one of which may not be recyclable, which the root leads with on about half the pages;
//     a long list renders only at the page level, through snippets and child components too, since
//     each counts the lists around it and renders only where no more are; and a page renders at
//     most `MOST_ROWS` rows at once;
//   - static and dynamic attributes, classes (text and object), styles (text and `style:`),
//     `data-*` (text, number and object), `id`, an attribute of Lynx's, and a `tap` handler that
//     changes the state;
//   - `{#if}` with `{:else if}` and `{:else}`, `{#if background}` and its kin from
//     `@sohedra/lynx/environment`, `{#await}` given a value or a promise that never settles, a
//     `<svelte:boundary>` with a `failed` snippet,
//     `{#each}` keyed and unkeyed, `{#key}`, `<svelte:element>`, child components with props and a
//     `--x` prop, snippets with `{@render}`, and `$props.id()`, also in a component that a branch
//     only one thread renders holds, and after it;
//   - texts that are empty, spaces, `<`, `&`, a line separator, quotes and non-ASCII;
//   - attributes set and taken away again, and `{#each}` with `{:else}`.
//
// A page's source is compact or indented, compiled for development or production, and its data
// comes partly from the template and partly from the host.
//
// Never what Svelte's custom renderers leave out (element `bind:`, transitions, animations,
// `{@html}`, `on:`, `<svelte:window>` and its kin).

import fc from "fast-check";

import { longList, MOST_LISTS, nested, nodes } from "./markup.ts";
import type { Context, MarkupNode, Renderable, Scope } from "./markup.ts";
import { pageShape } from "./shape.ts";
import { pageState, STATE_KEYS, STRING_KEYS } from "./state.ts";
import type { PageState } from "./state.ts";

export type { PageState } from "./state.ts";

/** A component of a page. */
export interface ComponentModel extends Renderable {
	/** Where it is used: among elements, or inside a `<text>`. */
	context: Context;
	/** Whether it calls `$props.id()`. */
	uid: boolean;
	snippets: (Renderable & { body: MarkupNode[] })[];
	body: MarkupNode[];
}

/** A generated page: its components, the root last, and the data it starts with. */
export interface PageModel {
	components: ComponentModel[];
	data: PageState;
	/** The keys of the data that come from the template; the host gives the rest. */
	fromTemplate: (keyof PageState)[];
	/** Whether the source is indented, with a line and a tab between nodes, as people write it. */
	indented: boolean;
	/** Whether the page is compiled for production. */
	production: boolean;
}

/**
 * The most rows a page renders at once (`PageShape.rows`): about a dozen long lists' worth. About
 * 98% of pages render no more; one past it is made again. The rules on lists keep nested long
 * lists out, but `{#each}`, snippets and components still multiply rows: a page that nested long
 * lists rendered tens of thousands of rows, and never finished.
 */
export const MOST_ROWS = 300;

const ROOT_TEXTS = STRING_KEYS.map((key) => `st.${key}`);

/** The lists a component or snippet counts around it: from `least`, as many as the rule allows. */
const listsAround = (least: number): fc.Arbitrary<number> =>
	fc.integer({ min: least, max: MOST_LISTS });

function component(options: {
	name: string;
	context: Context;
	lists: number;
	isRoot: boolean;
	uses: readonly Renderable[];
	size: number;
}): fc.Arbitrary<ComponentModel> {
	const { name, context, lists, isRoot, uses, size } = options;
	return fc
		.record({
			uid: fc.boolean(),
			snippetPlaces: fc.array(
				fc.record({
					context: fc.constantFrom<Context>("block", "inline"),
					// It renders in this component's markup, where at least as many lists are around.
					lists: listsAround(lists),
				}),
				{ maxLength: 2 },
			),
		})
		.chain(({ uid, snippetPlaces }) => {
			const texts = isRoot ? [...ROOT_TEXTS] : [...ROOT_TEXTS, "label"];
			const base: Scope = {
				texts: uid ? [...texts, "uid"] : texts,
				depth: 0,
				lists,
				components: uses,
				snippets: [],
				uid,
			};
			const named = snippetPlaces.map((place, index) => ({ name: `piece${index}`, ...place }));
			const scope = nested(base, { snippets: named });
			// The root leads with a long list on about half the pages: scrolls then release rows.
			const body = isRoot
				? fc
						.tuple(
							fc.option(longList(scope), { nil: undefined, freq: 2 }),
							nodes(context, scope, size),
						)
						.map(([long, rest]) => (long ? [long, ...rest] : rest))
				: nodes(context, scope, size);
			return fc
				.record({
					snippets: fc.tuple(
						...named.map((snippet) => {
							const snippetScope = nested(base, {
								texts: [...base.texts, "p"],
								lists: snippet.lists,
							});
							return nodes(snippet.context, snippetScope, size - 1).map((body) => ({
								...snippet,
								body,
							}));
						}),
					),
					body,
				})
				.map(({ snippets, body }): ComponentModel => ({
					name,
					context,
					lists,
					uid,
					snippets,
					body,
				}));
		});
}

/** A whole page. */
export const pageModel: fc.Arbitrary<PageModel> = fc
	.array(
		fc.record({ context: fc.constantFrom<Context>("block", "inline"), lists: listsAround(0) }),
		{ maxLength: 2 },
	)
	.chain((childPlaces) => {
		const children = childPlaces.map((place, index) => ({ name: `Child${index}`, ...place }));
		const arbitraries = children.map((child, index) =>
			component({
				...child,
				isRoot: false,
				// A child uses only the children after it: no cycle.
				uses: children.slice(index + 1),
				size: 2,
			}),
		);
		return fc.record({
			components: fc
				.tuple(
					...arbitraries,
					component({
						name: "App",
						context: "block",
						lists: 0,
						isRoot: true,
						uses: children,
						size: 4,
					}),
				)
				.map((all) => [...all]),
			data: pageState,
			fromTemplate: fc.subarray([...STATE_KEYS]),
			indented: fc.boolean(),
			production: fc.boolean(),
		});
	})
	.filter((page) => pageShape(page).rows <= MOST_ROWS);
