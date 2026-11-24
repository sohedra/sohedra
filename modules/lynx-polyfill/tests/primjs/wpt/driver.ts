// Runs web-platform-tests on PrimJS with WPT's own testharness.js, as Node.js runs them
// (test/common/wpt.js): each test file in a realm of its own, which gets, in order, the thread's
// script (thread-script.ts: what the thread has, its fills, and bridge.ts), testharness.js, the
// scripts the file names in `// META: script=` lines, and the file. The harness's results come
// back through `add_result_callback` and `add_completion_callback`, and are compared with the
// folder's status file (../status.ts).
//
// The files run are the folder's `*.any.js`, the tests WPT writes for any global; `.window.js`,
// `.worker.js` and `.html` tests need a browser's window or a worker. A file with `// META:
// variant=` lines runs once a variant, with `location.search` set to it, which is how a variant
// picks its subtests.

import fs from "node:fs";
import path from "node:path";

import { runShell } from "../primjs.ts";
import type { Engine } from "../primjs.ts";
import type { FileResult, Outcome } from "../status.ts";

/** The WPT commit the suite runs: web-platform-tests/wpt's master of 2026-11-24. */
export const WPT_COMMIT = "0936286d874b7d5ddcb68ecf47509995c953d750";

export const WPT_URL = "https://github.com/web-platform-tests/wpt.git";

/** The status files, one a folder of WPT: `status/html/webappapis/atob.json` is that folder's. */
export const STATUS_FOLDER: string = path.join(import.meta.dirname, "status");

/** The name of the outcome that stands for the harness itself: its status, and a script that threw. */
export const HARNESS = "<harness>";

/** The WPT folders the suite runs: those with a status file. */
export function wptFolders(): string[] {
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

/** The paths of WPT, besides the folders run, that their tests read. */
const SHARED_PATHS = [
	// testharness.js, idlharness.js and the scripts tests name in `// META: script=`.
	"/resources/",
	"/common/",
	// The Web IDL that idlharness.js tests check an interface against.
	"/interfaces/",
	// The cases html/webappapis/atob reads.
	"/fetch/data-urls/resources/",
];

/** The paths of WPT the suite reads: the shared ones and each folder. */
export function wptPaths(): string[] {
	return [...SHARED_PATHS, ...wptFolders().map((folder) => `/${folder}/`)];
}

/** The test files of `folder` of the WPT checkout at `root`, from the folder. */
export function testFiles(root: string, folder: string): string[] {
	return fs
		.readdirSync(path.join(root, folder), { recursive: true, encoding: "utf8" })
		.map((file) => file.split(path.sep).join("/"))
		.filter((file) => file.endsWith(".any.js"))
		.sort();
}

/** The `// META:` lines of a test file, by key, in order. */
export function readMeta(source: string): Map<string, string[]> {
	const meta = new Map<string, string[]>();
	for (const match of source.matchAll(/^\/\/\s*META:\s*([\w-]+)=(.*)$/gm)) {
		const [, key, value] = match;
		meta.set(key!, [...(meta.get(key!) ?? []), value!.trim()]);
	}
	return meta;
}

/** A script a test file names: from WPT's root when it starts with `/`, else from the file. */
function scriptPath(root: string, file: string, script: string): string {
	return script.startsWith("/")
		? path.join(root, script)
		: path.join(root, path.dirname(file), script);
}

/** The results of one run of the shell, as outcomes. */
function outcomesOf(run: Awaited<ReturnType<typeof runShell>>): Outcome[] {
	const outcomes: Outcome[] = [];
	const harnessProblems: string[] = [];
	let completed = false;
	for (const message of run.reports) {
		if (message["type"] === "result") {
			const status = String(message["status"]);
			outcomes.push({
				name: String(message["name"]),
				passed: status === "PASS",
				message: `${status}: ${String(message["message"] ?? "")}`,
			});
		} else if (message["type"] === "completion") {
			completed = true;
			if (message["status"] !== "OK")
				harnessProblems.push(`${String(message["status"])}: ${String(message["message"] ?? "")}`);
		} else if (message["type"] === "script-error") {
			harnessProblems.push(`${String(message["file"])} threw ${String(message["message"])}`);
		}
	}
	if (!completed) {
		const why = run.timedOut ? "ran out of time" : `exited with ${run.status}`;
		harnessProblems.push(
			`the harness did not finish: the shell ${why}\n${run.output.slice(-2000)}`,
		);
	}
	outcomes.push({
		name: HARNESS,
		passed: harnessProblems.length === 0,
		...(harnessProblems.length > 0 && { message: harnessProblems.join("\n") }),
	});
	return outcomes;
}

/** Runs the test file `file` of the WPT checkout at `root`, on `engine`, in `thread`'s realm. */
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
	const source = fs.readFileSync(path.join(root, file), "utf8");
	const meta = readMeta(source);
	const scripts = [
		...(meta.get("script") ?? []).map((script) => scriptPath(root, file, script)),
		path.join(root, file),
	];
	const variants = meta.get("variant") ?? [""];
	const byName = new Map<string, Outcome>();
	for (const [index, variant] of variants.entries()) {
		const main = path.join(work, `${file.replace(/[^\w.-]/g, "_")}.${index}.js`);
		fs.writeFileSync(
			main,
			[
				`load(${JSON.stringify(threadScript)});`,
				...(variant === ""
					? []
					: [`globalThis.location = { search: ${JSON.stringify(variant)} };`]),
				`load(${JSON.stringify(path.join(root, "resources/testharness.js"))});`,
				`wptDriver.connect(${JSON.stringify(root)}, ${JSON.stringify(path.join(root, path.dirname(file)))});`,
				`for (const script of ${JSON.stringify(scripts)}) {`,
				"\ttry { load(script); } catch (error) { wptDriver.scriptError(script, error); }",
				"}",
			].join("\n"),
		);
		for (const outcome of outcomesOf(await runShell(engine, [main]))) {
			const previous = byName.get(outcome.name);
			// A name in several variants (the harness's own) fails when it fails in any.
			if (!previous || (previous.passed && !outcome.passed)) byName.set(outcome.name, outcome);
		}
	}
	return { file, outcomes: [...byName.values()] };
}
