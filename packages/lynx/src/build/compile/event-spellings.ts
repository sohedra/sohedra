// An event attribute written in Lynx's own spelling (`bindtap`, `catchtap`, `capture-bindtap`,
// `capture-catchtap`, `global-bindtap`, also after `main-thread:`) is an error: a component
// writes `ontap`, `oncatchtap`, `ontapcapture` and `oncatchtapcapture`, with one grammar
// everywhere, and a listener on the page's root is `on(root, …)`.

import { attributeName, attributesOf, attributeValue, nodes } from "../../svelte/build/index.ts";
import { MAIN_THREAD_PREFIX, removedEventSpelling } from "../../wire/index.ts";
import { buildError, placeAt } from "../diagnostics/messages.ts";
import type { Pass } from "./pass.ts";

/** Refuses the attributes of elements that are written in Lynx's spelling of an event. */
export const eventSpellings: Pass = ({ source, filename, ast }) => {
	for (const record of nodes(ast.fragment)) {
		if (record.type !== "RegularElement" && record.type !== "SvelteElement") continue;
		for (const attribute of attributesOf(record)) {
			if (attribute.type !== "Attribute") continue;
			const value = attributeValue(attribute);
			// A handler is one expression; a string is not an event.
			if (value === true || value.length !== 1 || value[0]!.type !== "ExpressionTag") continue;
			const name = attributeName(attribute);
			const prefix = name.startsWith(MAIN_THREAD_PREFIX) ? MAIN_THREAD_PREFIX : "";
			const removed = removedEventSpelling(name.slice(prefix.length));
			if (removed === undefined) continue;
			const place = placeAt({ file: filename, text: source }, attribute.start!);
			if (removed.replacement === undefined)
				throw buildError({
					code: "global_event_attribute",
					details: { attribute: name, event: removed.event },
					place,
				});
			throw buildError({
				code: "event_attribute_renamed",
				details: { attribute: name, replacement: prefix + removed.replacement },
				place,
			});
		}
	}
	return [];
};
