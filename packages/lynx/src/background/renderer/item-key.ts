// An `item-key` as text, which Lynx's list needs.

import { sourceLocation } from "../../svelte/runtime/index.ts";
import { backgroundError } from "../catalogue.ts";
import { warnOnce } from "../report.ts";
import type { TreeNode } from "./node.ts";
import { textOf } from "./values.ts";

/**
 * `value` as the text of `element`'s `item-key`. A production build gives a keyed `{#each}`'s key
 * as text already; a development build gives it as it is, so that a key that is neither a string
 * nor a number is warned about here, naming the list item's place.
 */
export function itemKey(element: TreeNode, value: unknown): string {
	if (typeof value === "string") return value;
	if (typeof value === "number") return String(value);
	const where = sourceLocation(element);
	warnOnce(`list_item_key_object:${where ?? ""}`, () =>
		backgroundError({ code: "list_item_key_object", details: { where } }),
	);
	return textOf(value);
}
