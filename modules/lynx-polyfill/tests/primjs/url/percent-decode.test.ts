// The URL fill's percent-decoding on each PrimJS build and thread, against Node's `URLSearchParams`:
// PrimJS's `decodeURIComponent` decodes an encoded surrogate (`%ED%A0%80`) where the standard throws,
// and WPT has no such case.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterAll, describe, expect, it } from "@rstest/core";

import type { Thread } from "../../../src/fills/globals.ts";
import { ENGINES, runShell } from "../primjs.ts";
import { buildThreadScript } from "../thread-script.ts";
import { codeUnits, PERCENT_DECODE_CASES } from "./percent-decode-bridge.ts";

const THREADS: readonly Thread[] = ["background", "main-thread"];

const work = fs.mkdtempSync(path.join(os.tmpdir(), "sohedra-percent-decode-"));
afterAll(() => fs.rmSync(work, { recursive: true, force: true }));

const expected = Object.fromEntries(
	PERCENT_DECODE_CASES.map((bytes) => [
		bytes,
		codeUnits(new URLSearchParams(`a=${bytes}`).get("a")),
	]),
);

describe.each(ENGINES.map((engine) => ({ engine, name: engine.name })))(
	"URLSearchParams on the PrimJS of Lynx $name",
	({ engine }) => {
		it.each(THREADS)(
			"decodes bad UTF-8 as Node's does, on the %s",
			async (thread) => {
				const script = await buildThreadScript({
					thread,
					bridge: {
						module: "tests/primjs/url/percent-decode-bridge.ts",
						connect: "connectPercentDecode",
					},
					folder: path.join(work, engine.name),
				});
				const run = await runShell(engine, [script]);
				expect(run.output).toBe("");
				expect(run.reports).toEqual([expected]);
			},
			120_000,
		);
	},
);
