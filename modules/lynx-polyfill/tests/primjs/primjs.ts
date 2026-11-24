// Runs scripts on the PrimJS builds of scripts/primjs/build.ts, one shell process a script.

import { execFile } from "node:child_process";
import os from "node:os";

import { ENGINES, enginePath } from "../../scripts/primjs/build.ts";
import type { Engine } from "../../scripts/primjs/build.ts";
import { REPORT_PREFIX } from "./realm.ts";

export { ENGINES };
export type { Engine };

/** A message of the realm to the driver: an object of primitives (realm.ts, `report`). */
export type Report = Record<string, string | number | boolean | null>;

/** What a run of the shell gave. */
export interface ShellRun {
	/** The shell's exit status; `null` when it was stopped. */
	status: number | null;
	/** Whether it ran past its time and was stopped. */
	timedOut: boolean;
	/** What the realm told the driver (realm.ts, `report`), in order. */
	reports: Report[];
	/** The rest of standard output, and standard error. */
	output: string;
}

/** Runs the shell of `engine` with `args` (a script, or `--parse-module` and a module). */
export function runShell(
	engine: Engine,
	args: readonly string[],
	timeout = 60_000,
): Promise<ShellRun> {
	return new Promise((resolve) => {
		execFile(
			enginePath(engine),
			args,
			{ timeout, maxBuffer: 64 * 1024 * 1024, encoding: "utf8" },
			(error, stdout, stderr) => {
				const reports: Report[] = [];
				const rest: string[] = [];
				for (const line of stdout.split("\n")) {
					// Boundary: the realm writes one JSON object a line after the prefix.
					if (line.startsWith(REPORT_PREFIX))
						reports.push(JSON.parse(line.slice(REPORT_PREFIX.length)) as Report);
					else if (line !== "") rest.push(line);
				}
				// Boundary: execFile's error for a process that exited or was stopped.
				const failure = error as (Error & { code?: unknown; killed?: boolean }) | null;
				resolve({
					status: failure === null ? 0 : typeof failure.code === "number" ? failure.code : null,
					timedOut: failure?.killed === true,
					reports,
					output: [...rest, stderr].join("\n").trim(),
				});
			},
		);
	});
}

/** Runs `jobs` with as many at once as the computer has cores, and returns their results in order. */
export async function inParallel<T>(jobs: readonly (() => Promise<T>)[]): Promise<T[]> {
	const results: T[] = Array.from({ length: jobs.length });
	let next = 0;
	const worker = async (): Promise<void> => {
		while (next < jobs.length) {
			const index = next++;
			results[index] = await jobs[index]!();
		}
	};
	await Promise.all(
		Array.from({ length: Math.min(os.availableParallelism(), jobs.length) }, worker),
	);
	return results;
}
