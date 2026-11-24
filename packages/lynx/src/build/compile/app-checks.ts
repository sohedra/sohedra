// The checks of a component as the app's own code: the reads that fail on Lynx are errors
// (checks/script-checks.ts), and a selector Lynx doesn't support is a development warning
// (checks/css-selectors.ts). Only the background's copy checks, so each place is reported once.

import type { AnyNode } from "../../svelte/build/index.ts";
import { componentRoots } from "../checks/component-roots.ts";
import { unsupportedSelectors } from "../checks/css-selectors.ts";
import { checkScripts } from "../checks/script-checks.ts";
import { silencer } from "../checks/silencing.ts";
import { buildErrors, buildWarning, placeAt } from "../diagnostics/messages.ts";
import type { SourceText } from "../diagnostics/messages.ts";
import type { Pass } from "./pass.ts";

/** Checks the component's scripts, markup and styles. */
export const appChecks: Pass = (context) => {
	const { ast, source, filename, thread, development, checks } = context;
	if (checks !== true || thread !== "background") return [];
	const text: SourceText = { file: filename, text: source };
	if (development && ast.css) {
		const silenced = silencer(source);
		// Boundary: Svelte's style sheet node, read by shape.
		const sheet = ast.css as unknown as AnyNode;
		for (const found of unsupportedSelectors(sheet, source)) {
			if (silenced("css_selector_unsupported", found.start)) continue;
			context.warnings.push(
				buildWarning({
					code: "css_selector_unsupported",
					details: { selector: found.selector, part: found.part },
					place: placeAt(text, found.start),
				}),
			);
		}
	}
	const findings = checkScripts(text, componentRoots(ast));
	context.fills = { pending: findings.fills, imports: findings.imports };
	const [first, ...rest] = findings.errors;
	if (first !== undefined) throw buildErrors([first, ...rest]);
	return [];
};
