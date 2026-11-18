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
export interface Scope {
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

/** At least one node in `context`, at most `size` deep. */
function filled(context: Context, scope: Scope, size: number): fc.Arbitrary<MarkupNode[]> {
	if (size > 0) return fc.array(node(context, scope, size), { minLength: 1, maxLength: 2 });
	return context === "inline"
		? leafText(scope).map((text) => [text])
		: fc.constant<MarkupNode[]>([{ kind: "element", tag: "view", attributes: [], children: [] }]);
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
					/**
					 * Never empty: Svelte throws when an `{#each}` whose `{:else}` holds nothing fills.
					 * The canary in ./svelte-each-else.test.ts fails when that is fixed.
					 *
					 * @workaround svelte-empty-each-else kind=svelte-internal delete-when="Svelte fills an {#each} with an empty {:else} without throwing"
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
