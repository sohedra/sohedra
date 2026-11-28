// The comment rules of contributing/code.md that lint can't hold, in the primitives packages:
// - effect-comment: every `$effect`, `$effect.pre` and `watch` call in `src/` has a comment above
//   it that says what outside thing it keeps in step. One-line `const` captures may sit between.
// - comment-length: a comment this branch adds or changes runs three lines at most, counting the
//   lines with text. Doc comments, `@component` comments and tool directives don't count.
// - banned-words: no file names the library the primitives started from, uses the words of
//   `BANNED_WORDS`, or carries a private label (`T4`, "unit 3", "row 5"). NOTICE.txt is exempt.
//
//   node scripts/comments.ts          check, comment-length against the merge base with origin/main
//   node scripts/comments.ts --all    comment-length on every file

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { type Comment, codeText } from "./code-text.ts";
import { type Finding, unexempted } from "./exemptions.ts";
import { PRIMITIVES } from "./primitives-layout.ts";
import { sourceFiles } from "./source-files.ts";

const MAX_LINES = 3;
const SOURCE = /\.(?:[cm]?[jt]s|svelte)$/;
const TEXT = /\.(?:[cm]?[jt]s|svelte|json|jsonc|md|css|html|txt|yml|yaml)$/;
const EFFECT = /(?:\$effect(?:\.pre)?|(?<![\w.$])watch)\(/;
const CAPTURE = /^(?:const|let)\s+[\w$]+(?:\s*:\s*[^=]+)?\s*=\s*[^;]*;$/;
const TOOL =
	/^(?:\/\/\/|\/\/\s*(?:oxlint-|eslint-|@ts-|prettier-ignore|svelte-ignore)|<!--\s*svelte-ignore)|@__PURE__|#__NO_SIDE_EFFECTS__/;
const MARKER = /^\/\/ \d+\. /;

// Spelled in parts, so a search of the repository for these words finds only the code that uses them.
const words = (...parts: string[]): string => parts.join("");

/** Words no file of the primitives says, each with why. */
export const BANNED_WORDS: { pattern: RegExp; why: string }[] = [
	{
		pattern: new RegExp(words("base", "[ _-]?", "ui"), "i"),
		why: "the library the code started from is named only in NOTICE.txt; describe the behavior",
	},
	{
		pattern: new RegExp(
			String.raw`\b(?:${words("par", "ity")}|${words("po", "rt")}(?:s|ed|ing)?)\b`,
			"i",
		),
		why: "say what the code does, not what it matches or where it came from",
	},
	{ pattern: /\b[TDMR]\d{1,2}\b/, why: "a private label; say the rule itself" },
	{
		pattern: /\bdecision sheet\b|\b(?:unit|row) \d+\b/i,
		why: "a private label; say the rule itself",
	},
];

/** Files the checks leave alone, each with why. */
const SKIPS: Record<string, string> = {
	"packages/primitives-core/src/foundation/kernel/kernel-watch.svelte.ts":
		"It is `watch` itself: its effects are the ones every caller comments.",
};
const WORD_SKIPS = new Set(["NOTICE.txt"]);

/** Files whose long comments the length rule allows, each with why, or "todo:" to fix. */
const LENGTH_EXEMPTIONS: Record<string, string> = {};

/** Where an effect in the primitives' `src/` has no comment above it. */
export function checkEffectComments(root: string): string[] {
	const problems: string[] = [];
	for (const pkg of PRIMITIVES) {
		const under = join(root, "packages", pkg, "src");
		if (!existsSync(under)) continue;
		for (const { file, path } of sourceFiles(root, { under, names: SOURCE })) {
			if (file in SKIPS) continue;
			const { code, comments } = codeText(readFileSync(path, "utf8"), file);
			const commentEnds = new Set(comments.map((comment) => comment.end));
			const lines = code.split("\n");
			lines.forEach((line, index) => {
				const statement = line.trim();
				if (!EFFECT.test(statement) || /^(?:export\s+)?function\s+watch\b/.test(statement)) return;
				let above = index - 1;
				while (above >= 0 && CAPTURE.test(lines[above]!.trim())) above--;
				if (above < 0 || !commentEnds.has(above + 1)) {
					problems.push(
						`${file}:${index + 1}: say in a comment above this effect what outside thing it keeps in step.`,
					);
				}
			});
		}
	}
	return problems;
}

/**
 * Comments over three lines in the primitives packages: those that touch a line `base` doesn't
 * have, or every one when `base` is undefined. An exemption is checked against every file, so one
 * goes stale as soon as its file's comments are short.
 */
export function checkCommentLength(root: string, base: string | undefined): string[] {
	const changed = base === undefined ? undefined : changedLines(root, base);
	const findings: (Finding & { counts: boolean })[] = [];
	for (const pkg of PRIMITIVES) {
		const under = join(root, "packages", pkg);
		if (!existsSync(under)) continue;
		for (const { file, path } of sourceFiles(root, { under, names: SOURCE })) {
			const lines = changed?.get(file);
			for (const comment of runs(readFileSync(path, "utf8"), file)) {
				if (comment.lines <= MAX_LINES) continue;
				findings.push({
					key: file,
					message: `${file}:${comment.start}: this comment runs ${comment.lines} lines. Say why in ${MAX_LINES} at most, or move the explanation to contributing/, a test title or the pull request.`,
					counts:
						changed === undefined ||
						(lines ?? []).some((line) => line >= comment.start && line <= comment.end),
				});
			}
		}
	}
	const reported = new Set(
		findings.filter((finding) => finding.counts).map((finding) => finding.message),
	);
	return unexempted(findings, LENGTH_EXEMPTIONS, "scripts/comments.ts").filter(
		(problem) => reported.has(problem) || problem.startsWith("scripts/comments.ts"),
	);
}

/** Banned words in the primitives packages' files, outside NOTICE.txt. */
export function checkBannedWords(root: string): string[] {
	const problems: string[] = [];
	for (const pkg of PRIMITIVES) {
		const under = join(root, "packages", pkg);
		if (!existsSync(under)) continue;
		for (const { file, path } of sourceFiles(root, { under, names: TEXT })) {
			if (WORD_SKIPS.has(file.split("/").pop()!)) continue;
			readFileSync(path, "utf8")
				.split("\n")
				.forEach((line, index) => {
					for (const { pattern, why } of BANNED_WORDS) {
						const found = pattern.exec(line)?.[0];
						if (found !== undefined) {
							problems.push(`${file}:${index + 1}: "${found}": ${why}.`);
						}
					}
				});
		}
	}
	return problems;
}

/**
 * The comments of a file as a reader sees them: a run of whole-line `//` comments on adjacent
 * lines is one, a section marker stands alone, and each has the count of its lines with text.
 */
function runs(text: string, file: string): { start: number; end: number; lines: number }[] {
	const source = text.split("\n");
	const counted = codeText(text, file).comments.filter((comment) => !isExempt(comment));
	const merged: { start: number; end: number; lines: number }[] = [];
	for (const comment of counted) {
		const lines = textLines(comment);
		const previous = merged.at(-1);
		const wholeLine = comment.kind === "line" && source[comment.start - 1]!.trim().startsWith("//");
		if (wholeLine && previous?.end === comment.start - 1 && isWholeLine(source, previous.end)) {
			previous.end = comment.end;
			previous.lines += lines;
		} else {
			merged.push({ start: comment.start, end: comment.end, lines });
		}
	}
	return merged;
}

function isWholeLine(source: string[], line: number): boolean {
	const text = source[line - 1]!.trim();
	return text.startsWith("//") && !MARKER.test(text) && !TOOL.test(text);
}

function isExempt(comment: Comment): boolean {
	const first = comment.text.trimStart();
	if (comment.kind === "doc") return true;
	if (comment.kind === "html" && /^<!--\s*@component\b/.test(first)) return true;
	if (comment.kind === "line" && MARKER.test(first)) return true;
	return TOOL.test(first);
}

/** The lines of a comment that hold text, not only its delimiters. */
function textLines(comment: Comment): number {
	return comment.text
		.split("\n")
		.filter((line) => line.replace(/<!--|-->|\/\*+|\*+\/|^\s*\*|\/\//g, "").trim() !== "").length;
}

/**
 * What a branch is compared with: its merge base with origin/main, or origin/main itself in a
 * shallow clone (CI fetches main at depth 1), or undefined when this clone has no origin/main.
 */
export function mergeBase(root: string): string | undefined {
	const git = (...args: string[]): string =>
		execFileSync("git", args, {
			cwd: root,
			encoding: "utf8",
			stdio: ["ignore", "pipe", "ignore"],
		}).trim();
	try {
		return git("merge-base", "HEAD", "origin/main");
	} catch {
		// A shallow clone has no common history to find; the two trees still compare.
	}
	try {
		git("rev-parse", "--verify", "origin/main");
		return "origin/main";
	} catch {
		// No git, or no origin/main: nothing to compare with.
		return undefined;
	}
}

/** The lines each source file gained since `base`, with untracked files whole. */
function changedLines(root: string, base: string): Map<string, number[]> {
	const changed = new Map<string, number[]>();
	const git = (...args: string[]): string =>
		execFileSync("git", args, { cwd: root, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
	let file = "";
	const paths = PRIMITIVES.map((pkg) => `packages/${pkg}`).filter((path) =>
		existsSync(join(root, path)),
	);
	for (const line of git("diff", "-U0", "--diff-filter=d", base, "--", ...paths).split("\n")) {
		if (line.startsWith("+++ ")) file = line.slice(6);
		const hunk = /^@@ -\S+ \+(\d+)(?:,(\d+))? @@/.exec(line);
		if (hunk === null || !SOURCE.test(file)) continue;
		const start = Number(hunk[1]);
		const count = Number(hunk[2] ?? 1);
		const lines = changed.get(file) ?? [];
		for (let offset = 0; offset < count; offset++) lines.push(start + offset);
		changed.set(file, lines);
	}
	for (const untracked of git(
		"ls-files",
		"--others",
		"--exclude-standard",
		"-z",
		"--",
		...paths,
	).split("\0")) {
		if (!SOURCE.test(untracked) || !existsSync(join(root, untracked))) continue;
		const count = readFileSync(join(root, untracked), "utf8").split("\n").length;
		changed.set(
			untracked,
			Array.from({ length: count }, (_, index) => index + 1),
		);
	}
	return changed;
}

if (import.meta.main) {
	const all = process.argv.includes("--all");
	const base = all ? undefined : mergeBase(".");
	const problems = [...checkEffectComments("."), ...checkBannedWords(".")];
	if (all || base !== undefined) problems.push(...checkCommentLength(".", base));
	for (const problem of problems) console.error(problem);
	process.exit(problems.length > 0 ? 1 : 0);
}
