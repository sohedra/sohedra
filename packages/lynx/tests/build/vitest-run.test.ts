// The Vitest preset's suite (tests/vitest/): the library tests, and a project for each row of the
// parity table they do not cover, run by Vitest through `svelteLynx()`. Started from here so that
// `pnpm test` runs it: each Vitest test must pass.

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

import { beforeAll, describe, expect, it } from "@rstest/core";

const ROOT = path.resolve(import.meta.dirname, "../..");

interface Results {
	testResults: {
		name: string;
		assertionResults: { fullName: string; status: string; failureMessages: string[] }[];
	}[];
}

let results: Results;

describe("the Vitest preset's suite", { timeout: 300_000 }, () => {
	beforeAll(() => {
		const require = createRequire(import.meta.url);
		const bin = path.join(path.dirname(require.resolve("vitest/package.json")), "vitest.mjs");
		const report = path.join(ROOT, ".vitest/results.json");
		fs.rmSync(report, { force: true });
		try {
			execFileSync(
				process.execPath,
				[
					bin,
					"run",
					"-c",
					"tests/vitest/vitest.config.ts",
					"--root",
					".",
					"--reporter=json",
					`--outputFile=${report}`,
				],
				{ cwd: ROOT, encoding: "utf8", stdio: "pipe", env: { ...process.env, NODE_ENV: "test" } },
			);
		} catch {
			// It exits with 1 when a test fails; the report still says which.
		}
		results = JSON.parse(fs.readFileSync(report, "utf8")) as Results;
	});

	it("passes every test, under every project", () => {
		const tests = results.testResults.flatMap((file) =>
			file.assertionResults.map((test) => ({ file: path.relative(ROOT, file.name), ...test })),
		);
		const failed = tests
			.filter((test) => test.status !== "passed")
			.map((test) => `${test.file} > ${test.fullName}: ${test.failureMessages[0] ?? test.status}`);
		expect(failed).toEqual([]);
		expect(tests.length).toBeGreaterThan(90);
	});

	it("runs each row of the parity table", () => {
		const files = new Set(results.testResults.map((file) => path.relative(ROOT, file.name)));
		for (const row of ["options", "no-first-frame", "errors"])
			expect(files.has(`tests/vitest/${row}.test.ts`), row).toBe(true);
		expect(files.has("tests/library/counter.test.ts")).toBe(true);
	});
});
