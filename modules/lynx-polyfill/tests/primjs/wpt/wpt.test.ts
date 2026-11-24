// WPT on PrimJS: each folder with a status file, on each engine and each thread, against the
// folder's status file (driver.ts, ../status.ts).

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterAll, beforeAll, describe, expect, it } from "@rstest/core";

import type { Thread } from "../../../src/fills/globals.ts";
import { WPT_ROOT } from "../global-setup.ts";
import { ENGINES, inParallel } from "../primjs.ts";
import { expectationOf, judge, readStatus } from "../status.ts";
import { buildThreadScript } from "../thread-script.ts";
import { runTestFile, STATUS_FOLDER, testFiles, wptFolders } from "./driver.ts";

const THREADS: readonly Thread[] = ["background", "main-thread"];

let work: string;
const threadScripts = new Map<Thread, string>();

beforeAll(async () => {
	work = fs.mkdtempSync(path.join(os.tmpdir(), "sohedra-wpt-"));
	for (const thread of THREADS) {
		const script = await buildThreadScript({
			thread,
			bridge: { module: "tests/primjs/wpt/bridge.ts", connect: "connectWpt" },
			folder: path.join(work, "scripts"),
		});
		threadScripts.set(thread, script);
	}
});
afterAll(() => {
	fs.rmSync(work, { recursive: true, force: true });
});

describe.each(ENGINES.map((engine) => ({ engine, name: engine.name })))(
	"WPT on the PrimJS of Lynx $name",
	({ engine }) => {
		describe.each(THREADS)("on the %s", (thread) => {
			it.each(wptFolders())("%s matches its status file", async (folder) => {
				const realm = { thread, engine: engine.name };
				const status = readStatus(path.join(STATUS_FOLDER, `${folder}.json`));
				const files = testFiles(WPT_ROOT, folder);
				const toRun = files.filter((file) => !expectationOf(status, file, realm).skip);
				const folderWork = fs.mkdtempSync(path.join(work, "run-"));
				const results = await inParallel(
					toRun.map(
						(file) => () =>
							runTestFile({
								root: WPT_ROOT,
								file: `${folder}/${file}`,
								engine,
								threadScript: threadScripts.get(thread)!,
								work: folderWork,
							}).then((result) => ({ ...result, file })),
					),
				);
				const verdict = judge({ status, realm, files, results });
				expect(verdict.problems).toEqual([]);
			});
		});
	},
);
