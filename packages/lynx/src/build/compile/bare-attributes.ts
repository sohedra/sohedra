// Bare attributes on elements (`<video muted loop>`, `<list-item sticky-top>`, `<input disabled>`)
// are written `muted={true}`. Svelte compiles a bare attribute to the empty string, which Android
// and iOS read as false, and after compiling it can no longer be told from `muted=""`. Written
// out, `true` reaches the engine as the boolean; `attr=""` and `attr={''}` stay empty strings.
//
// Only elements (`RegularElement`): a component's bare prop is already `true` in Svelte, and
// `<svelte:element>` and the like are left alone.

import { attributesOf, nodes } from "../../svelte/build/index.ts";
import type { Pass } from "./pass.ts";

/**
 * The elements' bare attributes written as `name={true}`.
 *
 * @workaround explicit-bare-attributes kind=lynx-limit delete-when="Lynx reads an empty-string attribute as true for boolean attributes"
 */
export const bareAttributes: Pass = ({ ast }) => {
	const edits = [];
	for (const record of nodes(ast.fragment)) {
		if (record.type !== "RegularElement") continue;
		for (const attribute of attributesOf(record)) {
			if (attribute.type === "Attribute" && attribute.value === true) {
				const end = attribute.end!;
				edits.push({ start: end, end, text: "={true}" });
			}
		}
	}
	return edits;
};
