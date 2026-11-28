// Every `data-…` attribute and `--…` CSS variable the primitives write is named once, in its job's
// or component's constant: styling hooks in `<x>-attributes.ts`, internal markers in
// `<job>-markers.ts` or a module-level `const …_ATTRIBUTE`. Anywhere else in `src/`, code (not a
// comment) that spells one out fails, so a hook can't be renamed in one place and missed in another.
//
//   node scripts/styling-hooks.ts

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { codeText } from "./code-text.ts";
import { type Finding, unexempted } from "./exemptions.ts";
import { PRIMITIVES } from "./primitives-layout.ts";
import { sourceFiles } from "./source-files.ts";

const LITERAL = /(["'`])((?:data-[a-z][a-z0-9-]*|--[a-z][a-z0-9-]*))(?=[\s"'`=$])/g;
const MARKUP = /\s(data-[a-z][a-z0-9-]*)=|[:;"']\s*(--[a-z][a-z0-9-]*)\s*:/g;
const MARKER_CONSTANT = /^(?:export\s+)?const\s+[A-Z][A-Z0-9_]*_ATTRIBUTE\s*=\s*["'][^"']*["'];/;
const HOME = /-(?:attributes|markers)\.ts$/;

/** Literals outside a constant, keyed `<file>#<literal>`, each with why, or "todo:" to fix. */
const EXEMPTIONS: Record<string, string> = {};

/** Where code in the primitives' `src/` spells out a data attribute or CSS variable. */
export function checkStylingHooks(root: string): string[] {
	const findings: Finding[] = [];
	for (const pkg of PRIMITIVES) {
		const src = join(root, "packages", pkg, "src");
		if (!existsSync(src)) continue;
		for (const { file, path } of sourceFiles(root, { under: src, names: /\.(?:ts|svelte)$/ })) {
			if (HOME.test(file)) continue;
			const { code } = codeText(readFileSync(path, "utf8"), file);
			code.split("\n").forEach((line, index) => {
				if (MARKER_CONSTANT.test(line.trim())) return;
				const markup = file.endsWith(".svelte") ? [...line.matchAll(MARKUP)] : [];
				const names = [
					...[...line.matchAll(LITERAL)].map((found) => found[2]!),
					...markup.map((found) => (found[1] ?? found[2])!),
				];
				for (const name of names) {
					findings.push({
						key: `${file}#${name}`,
						message: `${file}:${index + 1}: "${name}" is spelled out here. Name it in its job's or component's constant (<x>-attributes.ts for a styling hook, <job>-markers.ts for a marker) and use that.`,
					});
				}
			});
		}
	}
	return unexempted(findings, EXEMPTIONS, "scripts/styling-hooks.ts");
}

if (import.meta.main) {
	const problems = checkStylingHooks(".");
	for (const problem of problems) console.error(problem);
	process.exit(problems.length > 0 ? 1 : 0);
}
