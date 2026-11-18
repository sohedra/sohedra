// The grammar of generated pages: small Svelte pages built from what the binding supports, as
// fast-check arbitraries, so that a failing page shrinks to the smallest one that still fails.
//
// A page is a root component, `App.svelte`, and up to two children. `App` owns the page's state,
// `st`, made from the page's data, and passes it to every child; each child also takes a `label`.
// What a page holds:
//
//   - elements: `<view>`, `<text>` (inline `<text>` and texts inside it), `<image>`, `<list>` with
//     `<list-item>`s, one list inside a list's item, and a list long enough that a scroll releases
//     rows, one of which may not be recyclable;
//   - static and dynamic attributes, classes (text and object), styles (text and `style:`),
//     `data-*` (text, number and object), `id`, an attribute of Lynx's, and a `tap` handler that
//     changes the state;
//   - `{#if}` with `{:else}`, `{#if background}` from `@sohedra/lynx/env`, `{#each}` keyed and
//     unkeyed, `{#key}`, `<svelte:element>`, child components with props and a `--x` prop,
//     snippets with `{@render}`, and `$props.id()`;
//   - texts that are empty, spaces, `<`, `&`, a line separator, quotes and non-ASCII;
//   - attributes set and taken away again, and `{#each}` with `{:else}`.
//
// A page's source is compact or indented, compiled for development or production, and its data
// comes partly from the template and partly from the host.
//
// Never what Svelte's custom-renderer build leaves out (element `bind:`, transitions, animations,
// `{@html}`, `on:`, `<svelte:window>` and its kin).

import fc from "fast-check";

import { nested, nodes } from "./markup.ts";
import type { Context, MarkupNode, Scope } from "./markup.ts";
import { pageState, STATE_KEYS, STRING_KEYS } from "./state.ts";
import type { PageState } from "./state.ts";

export type { PageState } from "./state.ts";

/** A component of a page. */
export interface ComponentModel {
	name: string;
	/** Where it is used: among elements, or inside a `<text>`. */
	context: Context;
	/** Whether it calls `$props.id()`. */
	uid: boolean;
	snippets: { name: string; context: Context; body: MarkupNode[] }[];
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

const ROOT_TEXTS = STRING_KEYS.map((key) => `st.${key}`);

function component(options: {
	name: string;
	context: Context;
	isRoot: boolean;
	uses: readonly { name: string; context: Context }[];
	size: number;
}): fc.Arbitrary<ComponentModel> {
	const { name, context, isRoot, uses, size } = options;
	return fc
		.record({
			uid: fc.boolean(),
			snippetContexts: fc.array(fc.constantFrom<Context>("block", "inline"), { maxLength: 2 }),
		})
		.chain(({ uid, snippetContexts }) => {
			const texts = isRoot ? [...ROOT_TEXTS] : [...ROOT_TEXTS, "label"];
			const base: Scope = {
				texts: uid ? [...texts, "uid"] : texts,
				depth: 0,
				lists: 0,
				components: uses,
				snippets: [],
				uid,
			};
			const named = snippetContexts.map((snippetContext, index) => ({
				name: `piece${index}`,
				context: snippetContext,
			}));
			const snippetScope = nested(base, { texts: [...base.texts, "p"] });
			return fc
				.record({
					snippets: fc.tuple(
						...named.map((snippet) =>
							nodes(snippet.context, snippetScope, size - 1).map((body) => ({ ...snippet, body })),
						),
					),
					body: nodes(context, nested(base, { snippets: named }), size),
				})
				.map(({ snippets, body }): ComponentModel => ({ name, context, uid, snippets, body }));
		});
}

/** A whole page. */
export const pageModel: fc.Arbitrary<PageModel> = fc
	.array(fc.constantFrom<Context>("block", "inline"), { maxLength: 2 })
	.chain((childContexts) => {
		const children = childContexts.map((context, index) => ({
			name: `Child${index}`,
			context,
		}));
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
					component({ name: "App", context: "block", isRoot: true, uses: children, size: 4 }),
				)
				.map((all) => [...all]),
			data: pageState,
			fromTemplate: fc.subarray([...STATE_KEYS]),
			indented: fc.boolean(),
			production: fc.boolean(),
		});
	});
