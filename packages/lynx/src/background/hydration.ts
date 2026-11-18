// The background's side of a refused hydration: the main thread found that its first frame differs
// from the page the background rendered, and asked for the page again. This says what differs, in
// the developer's names and at the element's place in a development build, with the code alone in
// a production build.

import { sourceLocation } from "../svelte/runtime/index.ts";
import type { HydrationMismatch } from "../wire/index.ts";
import { backgroundError } from "./catalogue.ts";
import type { BackgroundError } from "./catalogue.ts";
import { DEV } from "./globals.ts";

/** A value as the message shows it. */
function shown(value: unknown): string {
	return JSON.stringify(value) ?? String(value);
}

/** What differs, as a phrase; `tag` is the tag of the element the mismatch names. */
export function describeMismatch(mismatch: HydrationMismatch, tag: string): string {
	const { kind, name, expected, got } = mismatch;
	switch (kind) {
		case "attribute":
			if (expected === undefined)
				return `the <${tag}> has ${name ?? "an attribute"} ${shown(got)} in the first frame, and not on the background`;
			if (got === undefined)
				return `the <${tag}> has ${name ?? "an attribute"} ${shown(expected)} on the background, and not in the first frame`;
			return `the <${tag}>'s ${name ?? "attribute"} is ${shown(expected)} on the background and ${shown(got)} in the first frame`;
		case "tag":
			return got === undefined
				? `an element in the <${tag}> differs`
				: `the background rendered a <${shown(expected).replace(/^"|"$/g, "")}> where the first frame has a <${shown(got).replace(/^"|"$/g, "")}>`;
		case "missing":
			return `the background rendered a <${tag}> that the first frame does not have`;
		case "extra":
			return tag === "page"
				? `the first frame has a <${shown(got).replace(/^"|"$/g, "")}> at the page's root that the background did not render`
				: `the first frame has a <${shown(got).replace(/^"|"$/g, "")}> in the <${tag}> that the background did not render`;
		case "list-keys": {
			const keys = (value: unknown): string =>
				Array.isArray(value) && value.length > 0 ? value.join(", ") : "none";
			return `the items of the <${tag}> differ: the background has the keys ${keys(expected)}, and the first frame ${keys(got)}`;
		}
	}
}

/** The error for a refused hydration; `node` is the element it names, when the page has it. */
export function mismatchError(
	mismatch: HydrationMismatch | undefined,
	node: { tag: string | null } | undefined,
): BackgroundError {
	if (!DEV || mismatch === undefined || node === undefined)
		return backgroundError({ code: "hydration_mismatch", details: {} });
	return backgroundError({
		code: "hydration_mismatch",
		details: {
			difference: describeMismatch(mismatch, node.tag ?? "element"),
			where: sourceLocation(node),
		},
	});
}
