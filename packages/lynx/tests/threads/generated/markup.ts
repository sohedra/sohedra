// The markup of a generated page's components: elements, blocks, texts and attributes, as
// fast-check arbitraries over what a place in the markup may hold and name.

import fc from "fast-check";

import { ARRAY_KEYS } from "./state.ts";

/** Where a node is: among elements, or inside a `<text>`. */
export type Context = "block" | "inline";

/** A node of a component's markup, as Svelte source. */
export type MarkupNode =
	| {
			kind: "element";
			tag: "view" | "text" | "image";
			attributes: string[];
			children: MarkupNode[];
	  }
	| { kind: "list"; attributes: string[]; items: ListChild[] }
	| { kind: "text"; source: string }
	| { kind: "if"; condition: string; consequent: MarkupNode[]; otherwise: MarkupNode[] | undefined }
	| {
			kind: "each";
			array: string;
			item: string;
			keyed: boolean;
			body: MarkupNode[];
			/** `{:else}`: what shows when the array is empty. */
			otherwise: MarkupNode[] | undefined;
	  }
	| { kind: "key"; expression: string; body: MarkupNode[] }
	| { kind: "dynamic"; attributes: string[]; children: MarkupNode[] }
	| { kind: "component"; name: string; label: string; cssVariable: boolean }
	| { kind: "render"; snippet: string; argument: string };

/**
 * A child of a `<list>`: one `<list-item>`, an `{#each}` of them, or an `{#each}` of enough rows
 * for a scroll to hand back more than the main thread keeps (`rows`), the second of which may be
 * held for good (`fixed`).
 */
export type ListChild =
	| { kind: "item"; key: string; attributes: string[]; body: MarkupNode[] }
	| {
			kind: "items";
			array: string;
			item: string;
			keyed: boolean;
			prefix: string;
			attributes: string[];
			body: MarkupNode[];
	  }
	| { kind: "rows"; item: string; fixed: boolean; attributes: string[]; body: MarkupNode[] };

/** The most lists around one another: a list holds at most one more, in an item. */
export const MOST_LISTS = 2;

/**
 * A component or snippet, with its context and the lists its markup counts around it. It renders
 * only where that many lists or fewer are, so what its markup holds keeps the rules on lists
 * wherever it renders: a long list only at the page level, none in a long list's row.
 */
export interface Renderable {
	readonly name: string;
	readonly context: Context;
	/** At most `MOST_LISTS`: one that counts as many holds no list. */
	readonly lists: number;
}

/** What an expression may name where it is written. */
export interface Scope {
	/** Expressions of a text. */
	readonly texts: readonly string[];
	/** How many `{#each}` are around: the next item's name. */
	readonly depth: number;
	/** How many lists are around, or count as around: at most `MOST_LISTS`. */
	readonly lists: number;
	/** The components this one may use. */
	readonly components: readonly Renderable[];
	/** The snippets this component has; none inside a snippet. */
	readonly snippets: readonly Renderable[];
	/** Whether `uid` (`$props.id()`) is defined. */
	readonly uid: boolean;
}

const BOOLEANS = [
	"st.b0",
	"!st.b1",
	"st.n0 === 1",
	'st.s0 === ""',
	"st.a0.length > 1",
	"background",
] as const;

/** What a tap does to the state. */
const CHANGES = [
	"st.b0 = !st.b0",
	"st.b1 = !st.b1",
	"st.n0 = (st.n0 + 1) % 3",
	'st.s0 = st.s0 === "" ? "a" : ""',
	"st.s1 = st.s1 + st.s1.length",
	"st.a0 = [...st.a0.slice(1), ...st.a0.slice(0, 1)]",
	'st.a1 = st.a1.includes("z") ? st.a1.filter((x) => x !== "z") : [...st.a1, "z"]',
	"st.a0 = st.a0.slice(1)",
	'st.t0 = st.t0 === "view" ? "text" : "view"',
] as const;

/** Static texts as written in markup, where `<`, `&`, `{` are entities. */
const STATIC_TEXTS = ["A", "two words", "&lt;b&gt;", "&amp;", "é", "&#123;x}", "x\u2028y"] as const;

const textExpression = (scope: Scope): fc.Arbitrary<string> =>
	fc.constantFrom(...scope.texts, "String(st.n0)", '"lit"');

/** An attribute, as written. */
function attribute(scope: Scope, tag: string): fc.Arbitrary<string> {
	const options: fc.Arbitrary<string>[] = [
		fc.constantFrom('class="c1"', 'class="c1 c2"', 'style="color: red"', 'data-k="v"'),
		textExpression(scope).map((expression) => `class={${expression}}`),
		fc
			.constantFrom(...BOOLEANS.filter((b) => b !== "background"))
			.map((condition) => `class={{ on: ${condition}, off: !(${condition}) }}`),
		fc.constant('style={"width: " + st.n0 * 10 + "px"}'),
		fc.constant('style:color={st.b0 ? "red" : "blue"}'),
		textExpression(scope).map((expression) => `data-v={${expression}}`),
		fc.constant("data-n={st.n0}"),
		textExpression(scope).map((expression) => `data-o={{ s: ${expression} }}`),
		textExpression(scope).map((expression) => `accessibility-label={${expression}}`),
		// Values that take the attribute away again.
		textExpression(scope).map((expression) => `data-u={st.b0 ? ${expression} : undefined}`),
		fc.constant('class={st.b1 ? "c1" : undefined}'),
		fc.constant('style={st.b0 ? "color: red" : null}'),
		fc.constant('accessibility-label={st.b1 ? null : "x"}'),
	];
	if (scope.uid) options.push(fc.constant("id={uid}"));
	if (tag === "image") options.push(fc.constant('src="a.png"'));
	if (tag === "view" || tag === "text")
		options.push(fc.constantFrom(...CHANGES).map((change) => `ontap={() => (${change})}`));
	return fc.oneof(...options);
}

/** An element's attributes, with no name twice. */
function attributes(scope: Scope, tag: string): fc.Arbitrary<string[]> {
	return fc.uniqueArray(attribute(scope, tag), {
		maxLength: 3,
		selector: (written) => written.slice(0, written.search(/[={]/)),
	});
}

export function nested(scope: Scope, change: Partial<Scope>): Scope {
	return { ...scope, ...change };
}

function withItem(scope: Scope): { scope: Scope; item: string } {
	const item = `item${scope.depth}`;
	return { item, scope: nested(scope, { texts: [...scope.texts, item], depth: scope.depth + 1 }) };
}

/** Nodes in `context`, at most `size` deep. */
export function nodes(context: Context, scope: Scope, size: number): fc.Arbitrary<MarkupNode[]> {
	if (size <= 0) {
		return context === "inline" ? fc.array(leafText(scope), { maxLength: 2 }) : fc.constant([]);
	}
	return fc.array(node(context, scope, size), { maxLength: 3 });
}

/**
 * Nodes in `context`, at most `size` deep, that render a node whatever the state: a text or a
 * `<view>` first. A block or a component may render nothing.
 */
function filled(context: Context, scope: Scope, size: number): fc.Arbitrary<MarkupNode[]> {
	const first: fc.Arbitrary<MarkupNode> =
		context === "inline"
			? leafText(scope)
			: fc.constant({ kind: "element", tag: "view", attributes: [], children: [] });
	const rest = size > 0 ? fc.array(node(context, scope, size), { maxLength: 1 }) : fc.constant([]);
	return fc.tuple(first, rest).map(([head, tail]) => [head, ...tail]);
}

function leafText(scope: Scope): fc.Arbitrary<MarkupNode> {
	return fc.oneof(
		fc.constantFrom(...STATIC_TEXTS).map((source): MarkupNode => ({ kind: "text", source })),
		textExpression(scope).map((expression): MarkupNode => ({
			kind: "text",
			source: `{${expression}}`,
		})),
	);
}

function element(
	tag: "view" | "text" | "image",
	scope: Scope,
	size: number,
): fc.Arbitrary<MarkupNode> {
	const children: fc.Arbitrary<MarkupNode[]> =
		tag === "image" ? fc.constant([]) : nodes(tag === "text" ? "inline" : "block", scope, size - 1);
	return fc
		.record({ attributes: attributes(scope, tag), children })
		.map(({ attributes: written, children: inner }): MarkupNode => ({
			kind: "element",
			tag,
			attributes: written,
			children: inner,
		}));
}

/**
 * Long rows, only in a list of the page, whose rows are released; small, with no list in them: a
 * scroll shows them many times over.
 */
function rows(item: string, scope: Scope, size: number): fc.Arbitrary<ListChild> {
	return fc
		.record({
			fixed: fc.boolean(),
			attributes: attributes(scope, "view"),
			body: nodes("block", nested(scope, { lists: MOST_LISTS }), Math.min(1, size - 1)),
		})
		.map((each): ListChild => ({ kind: "rows", item, ...each }));
}

/** A list of the page with long rows only, which a scroll lets go of. */
export function longList(scope: Scope): fc.Arbitrary<MarkupNode> {
	const { item, scope: eachScope } = withItem(nested(scope, { lists: 1 }));
	return fc
		.record({ attributes: attributes(scope, "view"), child: rows(item, eachScope, 2) })
		.map(({ attributes: written, child }): MarkupNode => ({
			kind: "list",
			attributes: written,
			items: [child],
		}));
}

function list(scope: Scope, size: number): fc.Arbitrary<MarkupNode> {
	const inner = nested(scope, { lists: scope.lists + 1 });
	const listItem = fc
		.record({
			key: fc.constantFrom("s0", "s1", "s2"),
			attributes: attributes(inner, "view"),
			body: nodes("block", inner, size - 1),
		})
		.map(({ key, attributes: written, body }): ListChild => ({
			kind: "item",
			key,
			attributes: written,
			body,
		}));
	const { item, scope: eachScope } = withItem(inner);
	const eachItems = fc
		.record({
			array: fc.constantFrom(...ARRAY_KEYS.map((key) => `st.${key}`)),
			keyed: fc.boolean(),
			prefix: fc.constantFrom("e0", "e1"),
			attributes: attributes(eachScope, "view"),
			body: nodes("block", eachScope, size - 1),
		})
		.map((each): ListChild => ({ kind: "items", item, ...each }));
	const kinds =
		scope.lists === 0
			? fc.oneof(listItem, eachItems, { weight: 2, arbitrary: rows(item, eachScope, size) })
			: fc.oneof(listItem, eachItems);
	return fc
		.record({
			attributes: attributes(scope, "view"),
			items: fc.uniqueArray(kinds, {
				minLength: 1,
				maxLength: 2,
				// Keys stay unique in the list: one static item per key, one `{#each}` per prefix.
				selector: (child) =>
					child.kind === "item" ? child.key : child.kind === "items" ? child.prefix : "r",
			}),
		})
		.map(({ attributes: written, items: children }): MarkupNode => ({
			kind: "list",
			attributes: written,
			items: children,
		}));
}

/** Those of `renderables` that may render here: in `context`, with no more lists around. */
const renderableHere = (
	renderables: readonly Renderable[],
	context: Context,
	scope: Scope,
): Renderable[] => renderables.filter((one) => one.context === context && one.lists >= scope.lists);

function node(context: Context, scope: Scope, size: number): fc.Arbitrary<MarkupNode> {
	const { item, scope: eachScope } = withItem(scope);
	const options: fc.WeightedArbitrary<MarkupNode>[] = [
		{
			weight: 2,
			arbitrary: fc
				.record({
					condition: fc.constantFrom(...BOOLEANS),
					consequent: nodes(context, scope, size - 1),
					otherwise: fc.option(nodes(context, scope, size - 1), { nil: undefined }),
				})
				.map(({ condition, consequent, otherwise }): MarkupNode => ({
					kind: "if",
					condition,
					consequent,
					otherwise,
				})),
		},
		{
			weight: 1,
			arbitrary: fc
				.record({
					array: fc.constantFrom(...ARRAY_KEYS.map((key) => `st.${key}`)),
					keyed: fc.boolean(),
					body: nodes(context, eachScope, size - 1),
					/**
					 * Never without a node: Svelte throws when an `{#each}` whose `{:else}` renders no node
					 * fills, an empty one or one whose component renders nothing, on the DOM too. The
					 * canaries in ./svelte-each-else.test.ts and ./svelte-each-else-component.test.ts
					 * fail when each is fixed.
					 *
					 * @workaround svelte-empty-each-else kind=svelte-internal delete-when="Svelte fills an {#each} with an empty {:else}, or one whose component renders nothing, without throwing"
					 */
					otherwise: fc.option(filled(context, scope, size - 1), { nil: undefined }),
				})
				.map(({ array, keyed, body, otherwise }): MarkupNode => ({
					kind: "each",
					array,
					item,
					keyed,
					body,
					otherwise,
				})),
		},
		{
			weight: 1,
			arbitrary: fc
				.record({
					expression: fc.constantFrom("st.n0", "st.s0"),
					body: nodes(context, scope, size - 1),
				})
				.map(({ expression, body }): MarkupNode => ({ kind: "key", expression, body })),
		},
	];
	const components = renderableHere(scope.components, context, scope);
	if (components.length > 0) {
		options.push({
			weight: 2,
			arbitrary: fc
				.record({
					name: fc.constantFrom(...components.map((component) => component.name)),
					label: textExpression(scope),
					cssVariable: fc.boolean(),
				})
				.map(({ name, label, cssVariable }): MarkupNode => ({
					kind: "component",
					name,
					label,
					// A `--x` prop wraps the component in an element: not inside a `<text>`.
					cssVariable: cssVariable && context === "block",
				})),
		});
	}
	const snippets = renderableHere(scope.snippets, context, scope);
	if (snippets.length > 0) {
		options.push({
			weight: 1,
			arbitrary: fc
				.record({
					snippet: fc.constantFrom(...snippets.map((snippet) => snippet.name)),
					argument: textExpression(scope),
				})
				.map(({ snippet, argument }): MarkupNode => ({ kind: "render", snippet, argument })),
		});
	}
	if (context === "inline") {
		options.push(
			{ weight: 4, arbitrary: leafText(scope) },
			{ weight: 2, arbitrary: element("text", scope, size) },
		);
	} else {
		options.push(
			{ weight: 3, arbitrary: element("view", scope, size) },
			{ weight: 3, arbitrary: element("text", scope, size) },
			{ weight: 1, arbitrary: element("image", scope, size) },
			{
				weight: 1,
				arbitrary: fc
					.record({
						attributes: attributes(scope, "view"),
						// Its tag changes between `<view>` and `<text>`: what it holds fits both.
						children: fc.array(element("text", scope, size - 1), { maxLength: 2 }),
					})
					.map(({ attributes: written, children }): MarkupNode => ({
						kind: "dynamic",
						attributes: written,
						children,
					})),
			},
		);
		if (scope.lists < MOST_LISTS) options.push({ weight: 2, arbitrary: list(scope, size) });
	}
	return fc.oneof({ depthSize: "small" }, ...options);
}
