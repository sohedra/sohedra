// The status files of the polyfill suites, as Node.js keeps its WPT status (test/common/wpt.js,
// test/wpt/status/): one JSON file a folder of the suite, its keys the folder's test files (a `*`
// in a key stands for any text), each with why it is skipped or which of its subtests fail and why:
//
//   {
//     "base64.any.js": { "fail": { "note": "why", "expected": ["a subtest's name"] } },
//     "clone.any.js": { "fail": [{ "note": "one reason", "expected": ["…"] }, { "note": …}] },
//     "*.window.js": { "skip": "why" },
//     "streams/*": { "skip": "why", "threads": ["main-thread"], "engines": ["4.2"] }
//   }
//
// `fail` is a group of subtests with their reason, or a list of groups. `threads` and `engines` (the
// engines' names, scripts/primjs/build.ts) limit a row or a group to those threads and engines. A
// run fails on a subtest that fails without a group and on one that passes with one, and on a row
// that matches no test file, so the file never goes stale.

import fs from "node:fs";

import type { Thread } from "../../src/wire/index.ts";
import { ENGINES } from "./primjs.ts";

const THREADS: readonly Thread[] = ["background", "main-thread"];

/** Where a row or a group applies: the threads and engines it names, or every one. */
interface Scope {
	threads?: Thread[];
	engines?: string[];
}

/** Subtests that fail, and why. */
export interface FailGroup extends Scope {
	note: string;
	expected: string[];
}

/** A row of a status file. */
export interface StatusRow extends Scope {
	/** Why the file isn't run. */
	skip?: string;
	/** The subtests that fail, and why. */
	fail?: FailGroup | FailGroup[];
}

/** A status file: its rows by file name or pattern. */
export type Status = Record<string, StatusRow>;

/** A thread on an engine, where a folder runs. */
export interface Realm {
	thread: Thread;
	/** The engine's name. */
	engine: string;
}

/** What is wrong with the `threads` and `engines` of a row or group, named `where`. */
function scopeProblems(where: string, scope: Record<string, unknown>): string[] {
	const problems: string[] = [];
	const { threads, engines } = scope;
	const names = ENGINES.map((engine) => engine.name);
	if (
		threads !== undefined &&
		(!Array.isArray(threads) ||
			threads.length === 0 ||
			!threads.every((thread) => THREADS.includes(thread as Thread)))
	)
		problems.push(`${where}: threads must list some of ${THREADS.join(", ")}.`);
	if (
		engines !== undefined &&
		(!Array.isArray(engines) ||
			engines.length === 0 ||
			!engines.every((engine) => names.includes(engine as string)))
	)
		problems.push(`${where}: engines must list some of ${names.join(", ")}.`);
	return problems;
}

/** What is wrong with a fail group, named `where`. */
function groupProblems(where: string, group: unknown): string[] {
	if (typeof group !== "object" || group === null || Array.isArray(group))
		return [`${where}: a fail group is an object with a note and the expected subtests.`];
	// Boundary: a parsed group, checked field by field.
	const { note, expected, threads, engines, ...rest } = group as Record<string, unknown>;
	const problems = Object.keys(rest).map((name) => `${where} has an unknown field "${name}".`);
	if (typeof note !== "string" || note.trim() === "")
		problems.push(`${where}: fail needs a note with the reason.`);
	if (
		!Array.isArray(expected) ||
		expected.length === 0 ||
		!expected.every((name) => typeof name === "string")
	)
		problems.push(`${where}: fail.expected must list the failing subtests' names.`);
	return [...problems, ...scopeProblems(where, { threads, engines })];
}

/** What is wrong with the rows of a status file, which reads as `value`. */
export function statusProblems(value: unknown): string[] {
	if (typeof value !== "object" || value === null || Array.isArray(value))
		return ["The status file is not a JSON object of rows by file name."];
	const problems: string[] = [];
	for (const [key, row] of Object.entries(value)) {
		const where = `"${key}"`;
		if (typeof row !== "object" || row === null || Array.isArray(row)) {
			problems.push(`${where} is not an object.`);
			continue;
		}
		// Boundary: a parsed row, checked field by field below.
		const { skip, fail, threads, engines, ...rest } = row as Record<string, unknown>;
		for (const name of Object.keys(rest)) problems.push(`${where} has an unknown field "${name}".`);
		if (skip === undefined && fail === undefined)
			problems.push(`${where} has neither skip nor fail.`);
		if (skip !== undefined && fail !== undefined) problems.push(`${where} has both skip and fail.`);
		if (skip !== undefined && (typeof skip !== "string" || skip.trim() === ""))
			problems.push(`${where}: skip must be its reason.`);
		if (Array.isArray(fail)) {
			if (fail.length === 0) problems.push(`${where}: fail lists no group.`);
			for (const [index, group] of fail.entries())
				problems.push(...groupProblems(`${where} fail[${index}]`, group));
		} else if (fail !== undefined) problems.push(...groupProblems(where, fail));
		problems.push(...scopeProblems(where, { threads, engines }));
	}
	return problems;
}

/** Reads the status file at `file`, and throws on a row that is not well formed. */
export function readStatus(file: string): Status {
	const value: unknown = JSON.parse(fs.readFileSync(file, "utf8"));
	const problems = statusProblems(value);
	if (problems.length > 0) throw new Error(`${file}:\n${problems.join("\n")}`);
	// Boundary: checked just above.
	return value as Status;
}

/** Whether the key of a row matches the test file `name`. */
function keyMatches(key: string, name: string): boolean {
	if (!key.includes("*")) return key === name;
	const pattern = key.replace(/[\\^$+?.()|[\]{}]/g, "\\$&").replace(/\*/g, ".*");
	return new RegExp(`^${pattern}$`).test(name);
}

/** Whether a row or group applies in `realm`. */
function appliesIn(scope: Scope, realm: Realm): boolean {
	return (
		(!scope.threads || scope.threads.includes(realm.thread)) &&
		(!scope.engines || scope.engines.includes(realm.engine))
	);
}

/** The fail groups of a row, as a list. */
function groupsOf(row: StatusRow): FailGroup[] {
	if (row.fail === undefined) return [];
	return Array.isArray(row.fail) ? row.fail : [row.fail];
}

/** What the rows of `status` say of the test file `name` in `realm`. */
export function expectationOf(
	status: Status,
	name: string,
	realm: Realm,
): { skip?: string; expected: Set<string> } {
	const expected = new Set<string>();
	let skip: string | undefined;
	for (const [key, row] of Object.entries(status)) {
		if (!keyMatches(key, name) || !appliesIn(row, realm)) continue;
		skip ??= row.skip;
		for (const group of groupsOf(row))
			if (appliesIn(group, realm)) for (const subtest of group.expected) expected.add(subtest);
	}
	return { ...(skip !== undefined && { skip }), expected };
}

/** A subtest's result. */
export interface Outcome {
	name: string;
	passed: boolean;
	/** Why it failed. */
	message?: string;
}

/** The results of a test file. */
export interface FileResult {
	file: string;
	outcomes: Outcome[];
}

/** What a run of a folder in a realm gave, against its status file. */
export interface Verdict {
	passed: number;
	expectedFailures: number;
	skippedFiles: number;
	/** Each problem: an unexpected failure or pass, or a stale row. */
	problems: string[];
}

/** Compares the results of a folder's files in `realm` with its status file. */
export function judge(options: {
	status: Status;
	realm: Realm;
	/** Every test file of the folder. */
	files: readonly string[];
	/** The results of the files the status didn't skip. */
	results: readonly FileResult[];
}): Verdict {
	const { status, realm, files, results } = options;
	const verdict: Verdict = { passed: 0, expectedFailures: 0, skippedFiles: 0, problems: [] };
	for (const key of Object.keys(status))
		if (!files.some((file) => keyMatches(key, file)))
			verdict.problems.push(`The row "${key}" matches no test file: remove it.`);
	verdict.skippedFiles = files.filter((file) => expectationOf(status, file, realm).skip).length;
	for (const { file, outcomes } of results) {
		const { expected } = expectationOf(status, file, realm);
		const seen = new Set<string>();
		for (const outcome of outcomes) {
			seen.add(outcome.name);
			const failureExpected = expected.has(outcome.name);
			if (outcome.passed && failureExpected)
				verdict.problems.push(`${file}: "${outcome.name}" passes: remove it from fail.expected.`);
			else if (outcome.passed) verdict.passed++;
			else if (failureExpected) verdict.expectedFailures++;
			else
				verdict.problems.push(
					`${file}: "${outcome.name}" fails: ${outcome.message ?? "(no message)"}`,
				);
		}
		for (const name of expected)
			if (!seen.has(name))
				verdict.problems.push(`${file}: "${name}" is in fail.expected but did not run: remove it.`);
	}
	return verdict;
}
