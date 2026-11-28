// The doc comments of contributing/code.md § Comments, in the primitives' `src/`: every exported
// function and class has a `/** … */` right above it, and so does every field of an exported
// `…Props`, `…Deps`, `…Options` or `…State` interface (a part's public props and state, a store's or
// building block's inputs, a call's options) and every entry of a `…DataAttributes` or
// `…CssVariables` constant. The API reference is built from them.
//
//   node scripts/doc-comments.ts

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { codeText } from "./code-text.ts";
import { type Finding, unexempted } from "./exemptions.ts";
import { PRIMITIVES } from "./primitives-layout.ts";
import { sourceFiles } from "./source-files.ts";

const EXPORT =
	/^export\s+(?:declare\s+)?(?:(?:async\s+)?function\*?\s+([\w$]+)|(?:abstract\s+)?class\s+([\w$]+)|const\s+([\w$]+)(?:\s*:[^=]+)?\s*=\s*(?:async\s+)?(?:function\b|\(|<[\w\s,]+>\s*\(|[\w$]+\s*=>))/;
const INTERFACE =
	/^export\s+(?:interface\s+(\w+(?:Props|Deps|Options|State))\b|const\s+(\w+(?:DataAttributes|CssVariables))\s*=)/;
const MEMBER = /^(?:readonly\s+)?(?:[\w$]+|"[^"]*"|'[^']*'|\[[^\]]+\])\??\s*[:(<]/;

/** Declarations without a doc comment, keyed `<file>#<name>`, each with why, or "todo:" to fix. */
const EXEMPTIONS: Record<string, string> = {};

/** Where an export or a public field in the primitives' `src/` has no doc comment. */
export function checkDocComments(root: string): string[] {
	const findings: Finding[] = [];
	for (const pkg of PRIMITIVES) {
		const src = join(root, "packages", pkg, "src");
		if (!existsSync(src)) continue;
		for (const { file, path } of sourceFiles(root, { under: src, names: /\.ts$/ })) {
			if (file.endsWith("/index.ts")) continue;
			const { code, comments } = codeText(readFileSync(path, "utf8"), file, { strings: true });
			// A bundler annotation (`/*#__NO_SIDE_EFFECTS__*/`) may sit between a doc comment and its code.
			const annotations = new Set(
				comments
					.filter((comment) => /^\/\*\s*[#@]__/.test(comment.text))
					.map((comment) => comment.end),
			);
			const docEnds = new Set(
				comments
					.filter((comment) => comment.kind === "doc")
					.map((comment) => (annotations.has(comment.end + 1) ? comment.end + 1 : comment.end)),
			);
			const lines = code.split("\n");
			const missing = (index: number, name: string, what: string): void => {
				if (docEnds.has(index)) return;
				findings.push({
					key: `${file}#${name}`,
					message: `${file}:${index + 1}: ${what} has no doc comment. Say in one sentence what it is for.`,
				});
			};
			lines.forEach((line, index) => {
				const found = EXPORT.exec(line);
				const exported = found?.[1] ?? found?.[2] ?? found?.[3];
				if (exported !== undefined) missing(index, exported, `the export ${exported}`);
				const opened = INTERFACE.exec(line);
				const owner = opened?.[1] ?? opened?.[2];
				// A constant that names another's object (`= SwitchRootDataAttributes`) has no entries.
				if (owner === undefined || (opened?.[2] !== undefined && !/=\s*\{/.test(line))) return;
				// The brackets open at each line's start; a member starts a line inside the body alone.
				const open: string[] = [];
				let inBody = false;
				for (let at = index; at < lines.length; at++) {
					const text = lines[at]!;
					if (inBody && open.length === 1 && MEMBER.test(text.trim())) {
						const name = /^(?:readonly\s+)?([^?:(<\s]+)/.exec(text.trim())![1]!;
						missing(at, `${owner}.${name}`, `${owner}.${name}`);
					}
					for (const char of text.replaceAll("=>", "  ")) {
						if ("{([<".includes(char)) {
							if (char === "{" && open.length === 0) inBody = true;
							open.push(char);
						}
						if ("})]>".includes(char)) open.pop();
					}
					if (inBody && open.length === 0) break;
				}
			});
		}
	}
	return unexempted(findings, EXEMPTIONS, "scripts/doc-comments.ts");
}

if (import.meta.main) {
	const problems = checkDocComments(".");
	for (const problem of problems) console.error(problem);
	process.exit(problems.length > 0 ? 1 : 0);
}
