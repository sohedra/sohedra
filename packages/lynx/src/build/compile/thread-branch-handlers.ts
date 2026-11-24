// A main-thread handler (`main-thread:on…`, `main-thread:gesture`) inside a branch only one thread
// renders (`{#if background}`, `{#if mainThread}`, their `{:else}`) is a development warning: the
// first frame draws one side and the background the other, so a `runOnBackground` call the handler
// makes before the background takes the page over finds no background function to answer it. A
// handler passed down through props is not seen here; the main thread reports that one as it runs.

import { attributeName, attributesOf, field, nodes } from "../../svelte/build/index.ts";
import { MAIN_THREAD_PREFIX } from "../../wire/index.ts";
import { silencer } from "../checks/silencing.ts";
import { buildWarning, placeAt } from "../diagnostics/messages.ts";
import type { Pass } from "./pass.ts";
import { oneThreadFragments } from "./thread-branches.ts";

const CODE = "main_thread_handler_in_thread_branch";

/** Whether a `main-thread:` attribute takes a handler or a gesture, which may call the background. */
const isHandler = (name: string): boolean =>
	name.startsWith(`${MAIN_THREAD_PREFIX}on`) || name === `${MAIN_THREAD_PREFIX}gesture`;

/** Warns at each main-thread handler inside a branch only one thread renders. */
export const threadBranchHandlers: Pass = ({
	ast,
	source,
	filename,
	development,
	thread,
	checks,
	warnings,
}) => {
	if (!development || thread !== "background" || checks !== true) return [];
	const branches = oneThreadFragments(ast);
	if (branches.size === 0) return [];
	const silenced = silencer(source);
	const warned = new Set<number>();
	for (const [fragment, { block, alternate }] of branches) {
		const test = field(block, "test")!;
		const written = source.slice(test.start, test.end);
		const branch = alternate ? `the \`{:else}\` of \`{#if ${written}}\`` : `\`{#if ${written}}\``;
		for (const element of nodes(fragment)) {
			if (element.type !== "RegularElement" && element.type !== "SvelteElement") continue;
			for (const attribute of attributesOf(element)) {
				if (attribute.type !== "Attribute") continue;
				const name = attributeName(attribute);
				const start = attribute.start!;
				if (!isHandler(name) || warned.has(start)) continue;
				// A comment above the element silences its attributes, each on its own line or not.
				if (silenced(CODE, start) || silenced(CODE, element.start!)) continue;
				warned.add(start);
				warnings.push(
					buildWarning({
						code: CODE,
						details: { attribute: name, branch },
						place: placeAt({ file: filename, text: source }, start),
					}),
				);
			}
		}
	}
	return [];
};
