import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "@rstest/core";

import { lowered, readCoverageBaseline } from "../../../../../scripts/coverage-baseline.ts";

const folders: string[] = [];

/** A package folder whose tests/coverage-baseline.json holds `text`. */
function packageWith(text: string): string {
	const folder = fs.mkdtempSync(path.join(os.tmpdir(), "sohedra-coverage-"));
	folders.push(folder);
	fs.mkdirSync(path.join(folder, "tests"));
	fs.writeFileSync(path.join(folder, "tests/coverage-baseline.json"), text);
	return folder;
}

const baseline = { statements: 90, branches: 80, functions: 100, lines: 95.5 };

afterEach(() => {
	for (const folder of folders.splice(0)) fs.rmSync(folder, { recursive: true, force: true });
});

describe("the recorded coverage", () => {
	it("is read as the thresholds of a run", () => {
		expect(readCoverageBaseline(packageWith(JSON.stringify(baseline)))).toEqual(baseline);
	});

	it("is refused when a value is missing, not a number, or not a percentage", () => {
		for (const bad of [
			{ ...baseline, lines: undefined },
			{ ...baseline, branches: "80" },
			{ ...baseline, functions: 101 },
			{ ...baseline, statements: -1 },
		]) {
			expect(() => readCoverageBaseline(packageWith(JSON.stringify(bad)))).toThrow(
				/coverage-baseline\.json/,
			);
		}
	});

	it("is refused when the file is not JSON, or does not exist", () => {
		expect(() => readCoverageBaseline(packageWith("{"))).toThrow(/coverage-baseline\.json/);
		expect(() => readCoverageBaseline(os.tmpdir())).toThrow(/coverage-baseline\.json/);
	});
});

describe("a change to the recorded coverage", () => {
	it("may keep a value or raise it", () => {
		expect(lowered(baseline, baseline)).toEqual([]);
		expect(lowered({ ...baseline, branches: 85 }, baseline)).toEqual([]);
	});

	it("names each value it lowers", () => {
		expect(lowered({ ...baseline, branches: 79, lines: 90 }, baseline)).toEqual([
			"branches",
			"lines",
		]);
	});
});
