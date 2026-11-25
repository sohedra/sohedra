// The background's side of what hydration found. A refused hydration: the main thread's first
// frame differs from the page the background rendered, and the page is asked for again. And, in a
// development build, ids of `$props.id()` that differed, which the main thread wrote over. Each
// says what differs in the developer's names, at the element's place in a development build, and
// a refused one with its code alone in a production build.

import { sourceLocation } from "../svelte/runtime/index.ts";
import { unknownKind } from "../wire/index.ts";
import type { HydrationMismatch, PropsIdDifference } from "../wire/index.ts";
import { backgroundError } from "./catalogue.ts";
import type { BackgroundError } from "./catalogue.ts";
import { DEV } from "./globals.ts";
import { warnOnce } from "./report.ts";

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
		default:
			return `the <${tag}> differs in a way this build does not know (${unknownKind(kind)})`;
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

/**
 * Warns, once per element's place and attribute, about each id of `$props.id()` the main thread
 * wrote over the first frame's; `nodeOf` finds the element the difference names.
 */
export function warnPropsIds(
	differences: readonly PropsIdDifference[],
	nodeOf: (id: number) => { tag: string | null } | undefined,
): void {
	for (const { element: id, name, expected, got } of differences) {
		const element = nodeOf(id);
		const tag = element?.tag ?? "element";
		const where = element && sourceLocation(element);
		warnOnce(`props_id_mismatch:${where ?? tag}:${name}`, () => ({
			code: "props_id_mismatch",
			details: { tag, name, expected, got, where },
		}));
	}
}
