// The coverage a package's tests must reach, recorded in its tests/coverage-baseline.json. A package
// opts in by having the file and passing it to its test runner as thresholds. A pull request may
// raise the values, never lower them.

import { readFileSync } from "node:fs";
import { join } from "node:path";

export const METRICS = ["statements", "branches", "functions", "lines"] as const;

/** Percentages, from 0 to 100. */
export type Coverage = Record<(typeof METRICS)[number], number>;

/** The recorded coverage of the package in `folder`; throws when the file is missing or wrong. */
export function readCoverageBaseline(folder: string): Coverage {
	const file = join(folder, "tests/coverage-baseline.json");
	let data: Record<string, unknown>;
	try {
		// Boundary: JSON has no type.
		data = JSON.parse(readFileSync(file, "utf8")) as Record<string, unknown>;
	} catch {
		throw new Error(`${file} is missing or is not JSON. Record the package's coverage there.`);
	}
	for (const metric of METRICS) {
		const value = data[metric];
		if (typeof value !== "number" || value < 0 || value > 100) {
			throw new Error(`${file}: "${metric}" must be a number from 0 to 100.`);
		}
	}
	// Checked above: every metric is a number from 0 to 100.
	return data as Coverage;
}

/** The metrics whose value in `current` is below `previous`. */
export function lowered(current: Coverage, previous: Coverage): string[] {
	return METRICS.filter((metric) => current[metric] < previous[metric]);
}
