// Runs test262 on PrimJS with test262's own harness/ files, as test262's INTERPRETING.md says: each
// test file in a realm of its own, which gets, in order, the thread's script (thread-script.ts: what
// the thread has, its fills, and bridge.ts), assert.js and sta.js, doneprintHandle.js for an async
// test, the files its `includes` names, and the test. A test runs twice, as a script and in strict
// mode, unless its flags say otherwise; the two runs are its outcomes, `non-strict` and `strict`,
// compared with the folder's status file (../status.ts) as WPT's subtests are.
//
// A test that needs what this host doesn't give is skipped by its `features` (features.json): each
// entry says why. Module tests need a module loader the shell doesn't have, and fail.

import fs from "node:fs";
import path from "node:path";

import { runShell } from "../primjs.ts";
import type { Engine } from "../primjs.ts";
import type { FileResult, Outcome } from "../status.ts";

/** The test262 commit the suite runs: tc39/test262's main of 2026-11-23. */
export const TEST262_COMMIT = "ebf6ae620a0f292b4845cd4099cb9096735e64ae";

export const TEST262_URL = "https://github.com/tc39/test262.git";

/** The status files, one a folder of test262's `test/`: `status/built-ins/RegExp/escape.json`. */
export const STATUS_FOLDER: string = path.join(import.meta.dirname, "status");

/** The features this host can't run, each with why (`features` in a test's front matter). */
export const FEATURES_FILE: string = path.join(import.meta.dirname, "features.json");

/** The folders the suite runs: those with a status file. */
export function test262Folders(): string[] {
	const folders: string[] = [];
	const walk = (folder: string): void => {
		for (const entry of fs.readdirSync(path.join(STATUS_FOLDER, folder), { withFileTypes: true })) {
			const name = folder === "" ? entry.name : `${folder}/${entry.name}`;
			if (entry.isDirectory()) walk(name);
			else if (entry.name.endsWith(".json")) folders.push(name.slice(0, -".json".length));
		}
	};
	walk("");
	return folders.sort();
}

/** The paths of test262 the suite reads: the harness and each folder. */
export function test262Paths(): string[] {
	return ["/harness/", ...test262Folders().map((folder) => `/test/${folder}/`)];
}

/** The test files of `folder` of the test262 checkout at `root`, from the folder. */
export function testFiles(root: string, folder: string): string[] {
	return fs
		.readdirSync(path.join(root, "test", folder), { recursive: true, encoding: "utf8" })
		.map((file) => file.split(path.sep).join("/"))
		.filter((file) => file.endsWith(".js") && !file.endsWith("_FIXTURE.js"))
		.sort();
}

/** What a test's front matter says of how to run it. */
export interface FrontMatter {
	includes: string[];
	flags: string[];
	features: string[];
	/** The error the test must throw, and in which phase. */
	negative?: { phase: string; type: string };
}

/** A list in the front matter's YAML: `key: [a, b]`, or `key:` and a `- a` line each. */
function readList(yaml: string, key: string): string[] {
	const match = new RegExp(`^${key}:[ \\t]*(.*)$`, "m").exec(yaml);
	if (!match) return [];
	const inline = match[1]!.trim();
	if (inline.startsWith("["))
		return inline
			.slice(1, inline.lastIndexOf("]"))
			.split(",")
			.map((item) => item.trim())
			.filter((item) => item !== "");
	const items: string[] = [];
	for (const line of yaml.slice(match.index + match[0].length + 1).split("\n")) {
		const item = /^\s+-\s+(.+)$/.exec(line);
		if (!item) break;
		items.push(item[1]!.trim());
	}
	return items;
}

/** Reads the `/*--- … ---*\/` front matter of a test262 test. */
export function readFrontMatter(source: string): FrontMatter {
	const yaml = /\/\*---([\s\S]*?)---\*\//.exec(source)?.[1] ?? "";
	const negative = /^negative:\s*\n((?:[ \t]+.*\n?)+)/m.exec(yaml)?.[1];
	const field = (name: string): string | undefined =>
		negative && new RegExp(`^\\s+${name}:\\s*(\\S+)`, "m").exec(negative)?.[1];
	const phase = field("phase");
	const type = field("type");
	return {
		includes: readList(yaml, "includes"),
		flags: readList(yaml, "flags"),
		features: readList(yaml, "features"),
		...(phase !== undefined && type !== undefined && { negative: { phase, type } }),
	};
}

/** The features this host can't run, by name, with why. */
export function unsupportedFeatures(): Record<string, string> {
	// Boundary: a JSON object of reasons by feature, written by hand.
	return JSON.parse(fs.readFileSync(FEATURES_FILE, "utf8")) as Record<string, string>;
}

/** The modes a test runs in, by its flags. */
function modesOf(flags: readonly string[]): ("non-strict" | "strict")[] {
	if (flags.includes("raw") || flags.includes("noStrict") || flags.includes("module"))
		return ["non-strict"];
	if (flags.includes("onlyStrict")) return ["strict"];
	return ["non-strict", "strict"];
}

/** Runs the test file `file` (from `test/`) of the checkout at `root`, on `engine`, in a realm. */
export async function runTestFile(options: {
	root: string;
	file: string;
	engine: Engine;
	/** The thread's script, from buildThreadScript. */
	threadScript: string;
	/** Where the run may write its files. */
	work: string;
}): Promise<FileResult> {
	const { root, file, engine, threadScript, work } = options;
	const source = fs.readFileSync(path.join(root, "test", file), "utf8");
	const front = readFrontMatter(source);
	const raw = front.flags.includes("raw");
	const isAsync = front.flags.includes("async");
	const harness = raw
		? []
		: ["assert.js", "sta.js", ...(isAsync ? ["doneprintHandle.js"] : []), ...front.includes].map(
				(include) => path.join(root, "harness", include),
			);
	const outcomes: Outcome[] = [];
	for (const mode of modesOf(front.flags)) {
		const base = path.join(work, `${file.replace(/[^\w.-]/g, "_")}.${mode}`);
		const test = `${base}.test.js`;
		fs.writeFileSync(test, mode === "strict" ? `"use strict";\n${source}` : source);
		const main = `${base}.js`;
		fs.writeFileSync(
			main,
			[
				`load(${JSON.stringify(threadScript)});`,
				`test262Driver.run(${JSON.stringify({ scripts: [...harness, test], negative: front.negative ?? null, isAsync })});`,
			].join("\n"),
		);
		const run = await runShell(engine, [main], 20_000);
		outcomes.push({ name: mode, ...verdictOf(run, isAsync) });
	}
	return { file, outcomes };
}

/** Whether a run passed, and why not. */
function verdictOf(
	run: Awaited<ReturnType<typeof runShell>>,
	isAsync: boolean,
): { passed: boolean; message?: string } {
	const result = run.reports.find((message) => message["type"] === "result");
	const tail = run.output.slice(-1000);
	if (run.timedOut) return { passed: false, message: `the shell ran out of time\n${tail}` };
	if (!result) return { passed: false, message: `the test reported nothing\n${tail}` };
	if (result["passed"] !== true) return { passed: false, message: String(result["message"]) };
	if (isAsync) {
		// doneprintHandle.js prints one of these when the test calls $DONE.
		if (run.output.includes("Test262:AsyncTestFailure")) return { passed: false, message: tail };
		if (!run.output.includes("Test262:AsyncTestComplete"))
			return { passed: false, message: `the test never called $DONE\n${tail}` };
	}
	return { passed: true };
}
