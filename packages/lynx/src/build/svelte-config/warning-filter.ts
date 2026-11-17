// The Svelte warnings that do not apply on Lynx.

import type { Warning } from "../../svelte/build/index.ts";

/**
 * Svelte warnings that do not apply on Lynx. `attribute_illegal_colon`: a main-thread attribute is
 * written `main-thread:ontap`, and Lynx has no other attribute with a colon.
 */
const IGNORED_WARNINGS: ReadonlySet<string> = new Set(["attribute_illegal_colon"]);

/** The app's `warningFilter`, behind the warnings that do not apply on Lynx. */
export function lynxWarningFilter(
	appFilter?: (warning: Warning) => boolean,
): (warning: Warning) => boolean {
	return (warning) =>
		!IGNORED_WARNINGS.has(warning.code) && (appFilter === undefined || appFilter(warning));
}
