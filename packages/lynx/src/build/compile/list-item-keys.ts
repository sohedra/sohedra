// A list item needs a key, because Lynx's list tracks its cells by `item-key`. A `<list-item>`
// written directly inside a keyed `{#each}` takes the block's key expression as its `item-key`,
// so a list has the one key Svelte already asks for. Lynx's list drops an item whose key is not a
// non-empty string, so the key goes through `String`. An `item-key` written on the element wins.
// A `<list-item>` with no key at all (not directly in a keyed block, no `item-key`, no spread
// that could carry one) is a warning in a development build.

import { attributesOf, bodyNodes, field, nodes } from "../../svelte/build/index.ts";
import type { AnyNode } from "../../svelte/build/index.ts";
import { buildWarning, placeAt } from "../diagnostics/messages.ts";
import type { Edit } from "../source-map/edits.ts";
import type { Pass } from "./pass.ts";

const KEY = "item-key";
const TAG = "list-item";

/** The keys of the keyed blocks, by the list items written directly inside them. */
function blockKeys(root: unknown): Map<AnyNode, AnyNode> {
	const keys = new Map<AnyNode, AnyNode>();
	for (const block of nodes(root)) {
		if (block.type !== "EachBlock" || !block.key) continue;
		const key = field(block, "key");
		if (key === undefined) continue;
		for (const child of bodyNodes(block)) {
			if (child.type === "RegularElement" && child.name === TAG) keys.set(child, key);
		}
	}
	return keys;
}

/** Gives each list item its key, and warns about one with none. */
export const listItemKeys: Pass = ({ source, filename, ast, thread, development, warnings }) => {
	const keys = blockKeys(ast.fragment);
	const edits: Edit[] = [];
	for (const element of nodes(ast.fragment)) {
		if (element.type !== "RegularElement" || element.name !== TAG) continue;
		const attributes = attributesOf(element);
		if (attributes.some((attribute) => attribute.type === "Attribute" && attribute.name === KEY))
			continue;
		const key = keys.get(element);
		if (key !== undefined) {
			const at = element.start! + 1 + TAG.length;
			edits.push({
				start: at,
				end: at,
				text: ` ${KEY}={String(${source.slice(key.start, key.end)})}`,
			});
			continue;
		}
		// A spread may carry the key; the warning would be a guess.
		if (attributes.some((attribute) => attribute.type === "SpreadAttribute")) continue;
		if (development && thread === "background")
			warnings.push(
				buildWarning({
					code: "list_item_without_key",
					details: {},
					place: placeAt({ file: filename, text: source }, element.start!),
				}),
			);
	}
	return edits;
};
