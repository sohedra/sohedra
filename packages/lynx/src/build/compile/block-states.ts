// The blocks hydration pairs that are not an `{#if}`'s branch. Hydration pairs the first frame's
// blocks with the background's by the branch each took, which Svelte's `$.if` reports
// (`src/svelte/runtime/branch-marks.ts`). The first frame's markup also marks a block's second
// state, `<!--[!-->`: a list's `{:else}`, an `{#await}` given a value, a boundary's `pending`. So
// the background's copy puts each second state in an `{#if}` that says it is one:
//
//   {#each rows as row}…{:else}{#if __sohedraLynxSecond()}<text>None</text>{/if}{/each}
//
// An `{#await}` given a promise draws its branch on the background after the page started, and
// the first frame its pending branch, in a block of the binding's own (`<!--[await-->`). So the
// background's copy says what each `{#await}` was given, and an empty `{#if}` after the block
// marks its place when that was a promise:
//
//   {#await __sohedraLynxAwaitGiven(load())}…{/await}{#if __sohedraLynxAwaitPlace()}{/if}
//
// The first state of an `{#each}` with an `{:else}`, a boundary's children and an `{#await}`'s
// `{:then}` with no element have no mark. So both copies wrap such an `{#each}`, a boundary with a
// `pending` or a `failed`, and every `{#await}` in `{#if true}`: a state only one thread drew is
// then made again inside it, and its neighbors are paired as they are. An `{#await}` whose
// expression awaits (`{#await await x}`, async mode) says what it was given only once that settles,
// after the page started: its place is not marked, and its parent's children are made again.
//
// What closes a block rewrites the block's last character, so that it goes before what another
// pass inserts where the block ends, inner blocks first; what opens one is inserted after what
// another pass inserts there.

import { attributesOf, field, nodes } from "../../svelte/build/index.ts";
import type { AnyNode } from "../../svelte/build/index.ts";
import type { Edit } from "../source-map/edits.ts";
import type { PassContext } from "./pass.ts";

/** The hooks of the background's runtime the edits call. */
export type BlockStateHook = "second" | "awaitGiven" | "awaitPlace";

/** The nodes of a fragment field of a block (`fallback`, `then`, a snippet's `body`), blank text left out. */
function fragmentNodes(block: AnyNode, key: string): AnyNode[] {
	// Boundary: the node is read by shape; a fragment holds its nodes.
	return ((field(block, key)?.nodes ?? []) as AnyNode[]).filter(
		(node) => !(node.type === "Text" && String(node["data"]).trim() === ""),
	);
}

/** A boundary's snippet named `name`, written among its children. */
const snippetOf = (boundary: AnyNode, name: string): AnyNode | undefined =>
	// Boundary: the node is read by shape; a fragment holds its nodes.
	((field(boundary, "fragment")?.nodes ?? []) as AnyNode[]).find(
		(child) => child.type === "SnippetBlock" && field(child, "expression")?.["name"] === name,
	);

/** Whether a boundary has its state `name`, as a snippet or an attribute. */
const hasState = (boundary: AnyNode, name: string): boolean =>
	snippetOf(boundary, name) !== undefined ||
	attributesOf(boundary).some(
		(attribute) => attribute.type === "Attribute" && attribute.name === name,
	);

/**
 * The edits of one copy of a component: `hook` names a hook of the background's runtime, which the
 * caller imports.
 */
export function blockStateEdits(options: {
	ast: PassContext["ast"];
	source: string;
	background: boolean;
	hook: (name: BlockStateHook) => string;
}): Edit[] {
	const { ast, source, background, hook } = options;
	const edits: Edit[] = [];
	/** What follows each last character, outer blocks first as the walk meets them. */
	const following = new Map<number, string[]>();
	const after = (node: AnyNode, text: string): void => {
		const end = node.end!;
		let texts = following.get(end);
		if (!texts) following.set(end, (texts = []));
		texts.push(text);
	};
	const region = (node: AnyNode): void => {
		edits.push({ start: node.start!, end: node.start!, text: "{#if true}" });
		after(node, "{/if}");
	};
	const second = (inside: AnyNode[]): void => {
		const first = inside[0];
		const last = inside[inside.length - 1];
		if (!first || !last || !background) return;
		edits.push({ start: first.start!, end: first.start!, text: `{#if ${hook("second")}()}` });
		after(last, "{/if}");
	};
	for (const node of nodes(ast.fragment)) {
		if (node.type === "EachBlock") {
			const fallback = fragmentNodes(node, "fallback");
			if (fallback.length === 0) continue;
			region(node);
			second(fallback);
		} else if (node.type === "AwaitBlock") {
			region(node);
			if (!background) continue;
			const expression = field(node, "expression")!;
			// In parentheses of its own: a sequence's commas would separate the hook's arguments.
			edits.push(
				{ start: expression.start!, end: expression.start!, text: `${hook("awaitGiven")}((` },
				{ start: expression.end!, end: expression.end!, text: "))" },
			);
			second(fragmentNodes(node, "then"));
			after(node, `{#if ${hook("awaitPlace")}()}{/if}`);
		} else if (node.type === "SvelteBoundary") {
			if (!hasState(node, "pending") && !hasState(node, "failed")) continue;
			region(node);
			const pending = snippetOf(node, "pending");
			if (pending) second(fragmentNodes(pending, "body"));
		}
	}
	// The inner block closes first.
	for (const [end, texts] of following)
		edits.push({
			start: end - 1,
			end,
			text: source.slice(end - 1, end) + texts.reverse().join(""),
		});
	return edits;
}
