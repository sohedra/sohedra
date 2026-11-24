// The checks of the app's JavaScript and TypeScript modules, rune modules included, on the text as
// written (checks/script-checks.ts). A package's module is not checked, and neither is one that
// does not parse: the bundler reports that.

import { scriptParser } from "../../svelte/build/index.ts";
import { buildErrors } from "../diagnostics/messages.ts";
import type { SourceText } from "../diagnostics/messages.ts";
import { isAppCode } from "./app-code.ts";
import { NO_FILLS } from "./fills-store.ts";
import type { ModuleFills } from "./fills-store.ts";
import { checkScripts } from "./script-checks.ts";

/** Whether a module is written in TypeScript, by its file name. */
const isTypeScript = (file: string): boolean => /\.[mc]?tsx?$/.test(file);
/** Whether a module may hold JSX, by its file name. */
const isJsx = (file: string): boolean => /\.[jt]sx$/.test(file);
/** The scripts the checks read. */
const SCRIPT = /\.[mc]?[jt]sx?$/;

/**
 * Checks a module of the app as written: throws the build's error for what certainly fails, and
 * returns the reads that wait on a fill, with the fills the module imports and the globals it
 * installs.
 */
export function checkModule(source: SourceText, root: string): ModuleFills {
	if (!isAppCode(source.file, root) || !SCRIPT.test(source.file)) return NO_FILLS;
	const parse = scriptParser(root, { jsx: isJsx(source.file) });
	let program: unknown;
	try {
		program = parse(source.text, isTypeScript(source.file));
	} catch {
		return NO_FILLS;
	}
	const findings = checkScripts(source, { programs: [program] });
	const [first, ...rest] = findings.errors;
	if (first !== undefined) throw buildErrors([first, ...rest]);
	return { pending: findings.fills, imports: findings.imports, installs: findings.installs };
}
