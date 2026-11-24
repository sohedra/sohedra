// test262 on PrimJS: each folder with a status file, on each engine and each thread, against the
// folder's status file (driver.ts, ../status.ts).

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterAll, beforeAll, describe, expect, it } from "@rstest/core";

import type { Thread } from "../../../src/wire/index.ts";
import { TEST262_ROOT } from "../global-setup.ts";
import { ENGINES, inParallel } from "../primjs.ts";
import { expectationOf, judge, readStatus } from "../status.ts";
import { buildThreadScript } from "../thread-script.ts";
import {
	readFrontMatter,
	runTestFile,
	STATUS_FOLDER,
	test262Folders,
	testFiles,
	unsupportedFeatures,
} from "./driver.ts";

const THREADS: readonly Thread[] = ["background", "main-thread"];

let work: string;
const threadScripts = new Map<Thread, string>();

beforeAll(async () => {
	work = fs.mkdtempSync(path.join(os.tmpdir(), "sohedra-test262-"));
	for (const thread of THREADS) {
		const script = await buildThreadScript({
			thread,
			bridge: { module: "tests/polyfill/test262/bridge.ts", connect: "connectTest262" },
			folder: path.join(work, "scripts"),
		});
		threadScripts.set(thread, script);
	}
});
afterAll(() => {
	fs.rmSync(work, { recursive: true, force: true });
});

/** The features a test of `folder` names, by file. */
function featuresOf(folder: string): Map<string, string[]> {
	const features = new Map<string, string[]>();
	for (const file of testFiles(TEST262_ROOT, folder)) {
		const source = fs.readFileSync(path.join(TEST262_ROOT, "test", folder, file), "utf8");
		features.set(file, readFrontMatter(source).features);
	}
	return features;
}

it("skips only features some test of the suite names", () => {
	const named = new Set(
		test262Folders().flatMap((folder) => [...featuresOf(folder).values()].flat()),
	);
	const stale = Object.keys(unsupportedFeatures()).filter((feature) => !named.has(feature));
	expect(stale).toEqual([]);
});

describe.each(ENGINES.map((engine) => ({ engine, name: engine.name })))(
	"test262 on the PrimJS of Lynx $name",
	({ engine }) => {
		describe.each(THREADS)("on the %s", (thread) => {
			it.each(test262Folders())("%s matches its status file", async (folder) => {
				const realm = { thread, engine: engine.name };
				const status = readStatus(path.join(STATUS_FOLDER, `${folder}.json`));
				const unsupported = unsupportedFeatures();
				const features = featuresOf(folder);
				const files = [...features.keys()];
				const toRun = files.filter(
					(file) =>
						!expectationOf(status, file, realm).skip &&
						!features.get(file)!.some((feature) => feature in unsupported),
				);
				const folderWork = fs.mkdtempSync(path.join(work, "run-"));
				const results = await inParallel(
					toRun.map(
						(file) => () =>
							runTestFile({
								root: TEST262_ROOT,
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
