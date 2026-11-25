// The error constructors' stacks after the thread's fills, on each PrimJS build and thread: the
// fill that adds `cause` wraps each constructor, and an error's stack must still start at the
// function that made it, not at the wrapper or past the caller.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterAll, describe, expect, it } from "@rstest/core";

import type { Thread } from "../../../src/fills/globals.ts";
import { ENGINES, runShell } from "../primjs.ts";
import { buildThreadScript } from "../thread-script.ts";

const THREADS: readonly Thread[] = ["background", "main-thread"];

const work = fs.mkdtempSync(path.join(os.tmpdir(), "sohedra-error-stack-"));
afterAll(() => fs.rmSync(work, { recursive: true, force: true }));

describe.each(ENGINES.map((engine) => ({ engine, name: engine.name })))(
	"the error constructors on the PrimJS of Lynx $name",
	({ engine }) => {
		it.each(THREADS)(
			"keep where the error was made in its stack, and take a cause, on the %s",
			async (thread) => {
				const script = await buildThreadScript({
					thread,
					bridge: {
						module: "tests/primjs/language/error-stack-bridge.ts",
						connect: "connectErrorStack",
					},
					folder: path.join(work, engine.name),
				});
				const run = await runShell(engine, [script]);
				expect(run.output).toBe("");
				expect(run.reports).toEqual([
					{
						Error: "makeError connectErrorStack",
						EvalError: "makeEvalError connectErrorStack",
						RangeError: "makeRangeError connectErrorStack",
						ReferenceError: "makeReferenceError connectErrorStack",
						SyntaxError: "makeSyntaxError connectErrorStack",
						TypeError: "makeTypeError connectErrorStack",
						URIError: "makeURIError connectErrorStack",
						AggregateError: "makeAggregateError connectErrorStack",
						"a subclass": "AppError makeAppError",
						"Error called without new": "callError connectErrorStack",
					},
					{ Error: true, AggregateError: true },
				]);
			},
			120_000,
		);
	},
);
