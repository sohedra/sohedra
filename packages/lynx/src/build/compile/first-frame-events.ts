// For the first frame only: `ontap={fn}` on an element is written `bindtap={fn}` (`ontapcapture`
// `capture-bindtap`, `oncatchtap` `catchtap`, `oncatchtapcapture` `capture-catchtap`), which is
// how Lynx spells the event the element listens to. A main-thread function's `main-thread:ontap`
// becomes `main-thread:bindtap` the same way.
//
// Svelte's server compiler drops `on*` attributes, so without this the first frame would not
// know the element listens for `tap`. It needs to: Lynx only sends an event an element has a
// listener for (an image's `load`, a scroll-view's `scroll`), and the first frame's listeners
// keep such events until the background's handlers take them.

import { attributeName, attributesOf, attributeValue, nodes } from "../../svelte/build/index.ts";
import type { AnyNode } from "../../svelte/build/index.ts";
import { lynxEventName, MAIN_THREAD_PREFIX } from "../../wire/index.ts";
import type { Edit } from "../source-map/edits.ts";
import type { Pass } from "./pass.ts";

/**
 * Svelte's rule: an `on…` attribute with a single expression is an event, whatever follows `on`.
 * `name` is the attribute's name without its `main-thread:` prefix.
 */
function isEventAttribute(attribute: AnyNode, name: string): boolean {
	if (attribute.type !== "Attribute" || !name.startsWith("on")) return false;
	const value = attributeValue(attribute);
	return value !== true && value.length === 1 && value[0]!.type === "ExpressionTag";
}

/**
 * The first frame's copy of the component with its elements' `on…` attributes in Lynx's spelling.
 *
 * @workaround first-frame-event-attributes kind=svelte-internal delete-when="Svelte's server compiler keeps an element's on… attributes"
 */
export const firstFrameEvents: Pass = ({ source, ast, thread }) => {
	if (thread !== "main-thread") return [];
	const edits: Edit[] = [];
	for (const record of nodes(ast.fragment)) {
		if (record.type !== "RegularElement" && record.type !== "SvelteElement") continue;
		for (const attribute of attributesOf(record)) {
			// A spread or an attachment has no name.
			if (attribute.type !== "Attribute") continue;
			const written = attributeName(attribute);
			// `main-thread:ontap` is the event of a main-thread function: the prefix stays.
			const prefix = written.startsWith(MAIN_THREAD_PREFIX) ? MAIN_THREAD_PREFIX : "";
			const name = written.slice(prefix.length);
			if (!isEventAttribute(attribute, name)) continue;
			const start = attribute.start!;
			// The shorthand `{ontap}`.
			if (source.charCodeAt(start) === 123 /* { */)
				edits.push({ start, end: start, text: `${lynxEventName(name)}=` });
			else
				edits.push({
					start: start + prefix.length,
					end: start + written.length,
					text: lynxEventName(name),
				});
		}
	}
	return edits;
};
