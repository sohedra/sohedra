// The checks of a component as the app's own code: the reads that fail on Lynx are errors
// (checks/script-checks.ts). Only the background's copy checks, so each place is reported once.

import { componentRoots } from "../checks/component-roots.ts";
import { checkScripts } from "../checks/script-checks.ts";
import { buildErrors } from "../diagnostics/messages.ts";
import type { SourceText } from "../diagnostics/messages.ts";
import type { Pass } from "./pass.ts";

/** Checks the component's scripts and markup. */
export const appChecks: Pass = (context) => {
	const { ast, source, filename, thread, checks } = context;
	if (checks !== true || thread !== "background") return [];
	const text: SourceText = { file: filename, text: source };
	const findings = checkScripts(text, componentRoots(ast));
	context.fills = { pending: findings.fills, imports: findings.imports };
	const [first, ...rest] = findings.errors;
	if (first !== undefined) throw buildErrors([first, ...rest]);
	return [];
};
