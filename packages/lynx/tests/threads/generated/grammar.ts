// The grammar of generated pages: small Svelte pages built from what the binding supports, as
// fast-check arbitraries, so that a failing page shrinks to the smallest one that still fails.
//
// A page is a root component, `App.svelte`, and up to two children. `App` owns the page's state,
// `st`, made from the page's data, and passes it to every child; each child also takes a `label`.
// What a page holds:
//
//   - elements: `<view>`, `<text>` (inline `<text>` and texts inside it), `<image>`, `<list>` with
//     `<list-item>`s, one list inside a list's item;
//   - static and dynamic attributes, classes (text and object), styles (text and `style:`),
//     `data-*` (text, number and object), `id`, an attribute of Lynx's, and a `tap` handler that
//     changes the state;
//   - `{#if}` with `{:else}`, `{#if background}` from `@sohedra/lynx/env`, `{#each}` keyed and
//     unkeyed, `{#key}`, `<svelte:element>`, child components with props and a `--x` prop,
//     snippets with `{@render}`, and `$props.id()`;
//   - texts that are empty, spaces, `<`, `&`, a line separator, quotes and non-ASCII.
//
// Never what Svelte's custom-renderer build leaves out (element `bind:`, transitions, animations,
// `{@html}`, `on:`, `<svelte:window>` and its kin).

import fc from "fast-check";

// ---- The page's state ----------------------------------------------------------------------

/** The texts a page's state and its static texts take. */
export const TEXTS: readonly string[] = [
	"",
	" ",
	"a",
	"two words",
	"<",
	"a & b",
	"x y",
	"é ü",
	"<list-item",
	`'"`,
];

/** The values of the arrays `{#each}` goes over: distinct, so each can be a key. */
const ITEMS: readonly string[] = ["a", "b", "c", "<list-item", "é", "x y"];

/** The page's state, from its data: every page has all of it. */
export interface PageState {
	s0: string;
	s1: string;
	s2: string;
	b0: boolean;
	b1: boolean;
	n0: number;
	a0: string[];
	a1: string[];
	t0: "view" | "text";
}

/** The keys of the state, by kind. */
const STRING_KEYS = ["s0", "s1", "s2"] as const;
const ARRAY_KEYS = ["a0", "a1"] as const;

const items = (): fc.Arbitrary<string[]> =>
	fc.uniqueArray(fc.constantFrom(...ITEMS), { maxLength: 4 });

/** A value for one key of the state. */
export function stateValue(key: keyof PageState): fc.Arbitrary<PageState[keyof PageState]> {
	if (key.startsWith("s")) return fc.constantFrom(...TEXTS);
	if (key.startsWith("b")) return fc.boolean();
	if (key === "n0") return fc.integer({ min: 0, max: 2 });
	if (key === "t0") return fc.constantFrom("view" as const, "text" as const);
	return items();
}

/** The state a page starts with. */
export const pageState: fc.Arbitrary<PageState> = fc.record({
	s0: fc.constantFrom(...TEXTS),
	s1: fc.constantFrom(...TEXTS),
	s2: fc.constantFrom(...TEXTS),
	b0: fc.boolean(),
	b1: fc.boolean(),
	n0: fc.integer({ min: 0, max: 2 }),
	a0: items(),
	a1: items(),
	t0: fc.constantFrom("view" as const, "text" as const),
});

/** Every key of the state. */
export const STATE_KEYS: readonly (keyof PageState)[] = [
	"s0",
	"s1",
	"s2",
	"b0",
	"b1",
	"n0",
	"a0",
	"a1",
	"t0",
];

// ---- The markup ----------------------------------------------------------------------------

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
	| { kind: "each"; array: string; item: string; keyed: boolean; body: MarkupNode[] }
	| { kind: "key"; expression: string; body: MarkupNode[] }
	| { kind: "dynamic"; attributes: string[]; children: MarkupNode[] }
	| { kind: "component"; name: string; label: string; cssVariable: boolean }
	| { kind: "render"; snippet: string; argument: string };

/** A child of a `<list>`: one `<list-item>`, or an `{#each}` of them. */
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
	  };

/** What an expression may name where it is written. */
interface Scope {
	/** Expressions of a text. */
	readonly texts: readonly string[];
	/** How many `{#each}` are around: the next item's name. */
	readonly depth: number;
	/** How many lists are around: a list holds at most one more. */
	readonly lists: number;
	/** The components this one may use, with their context. */
	readonly components: readonly { name: string; context: Context }[];
	/** The snippets this component has, with their context; none inside a snippet. */
	readonly snippets: readonly { name: string; context: Context }[];
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
const STATIC_TEXTS = ["A", "two words", "&lt;b&gt;", "&amp;", "é", "&#123;x}"] as const;

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

function nested(scope: Scope, change: Partial<Scope>): Scope {
	return { ...scope, ...change };
}

function withItem(scope: Scope): { scope: Scope; item: string } {
	const item = `item${scope.depth}`;
	return { item, scope: nested(scope, { texts: [...scope.texts, item], depth: scope.depth + 1 }) };
}

/** Nodes in `context`, at most `size` deep. */
function nodes(context: Context, scope: Scope, size: number): fc.Arbitrary<MarkupNode[]> {
	if (size <= 0) {
		return context === "inline" ? fc.array(leafText(scope), { maxLength: 2 }) : fc.constant([]);
	}
	return fc.array(node(context, scope, size), { maxLength: 3 });
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
	return fc
		.record({
			attributes: attributes(scope, "view"),
			items: fc.uniqueArray(fc.oneof(listItem, eachItems), {
				minLength: 1,
				maxLength: 2,
				// Keys stay unique in the list: one static item per key, one `{#each}` per prefix.
				selector: (child) => (child.kind === "item" ? child.key : child.prefix),
			}),
		})
		.map(({ attributes: written, items: children }): MarkupNode => ({
			kind: "list",
			attributes: written,
			items: children,
		}));
}

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
				})
				.map(({ array, keyed, body }): MarkupNode => ({ kind: "each", array, item, keyed, body })),
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
	const components = scope.components.filter((component) => component.context === context);
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
	const snippets = scope.snippets.filter((snippet) => snippet.context === context);
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
		if (scope.lists < 2) options.push({ weight: 2, arbitrary: list(scope, size) });
	}
	return fc.oneof({ depthSize: "small" }, ...options);
}

// ---- Components ----------------------------------------------------------------------------

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
		});
	});
