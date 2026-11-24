// The status files of the polyfill suites on PrimJS (tests/polyfill/), which a change can edit
// without running the suites: each row well formed, with its reason.

import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "@rstest/core";

import { statusProblems } from "../../polyfill/status.ts";
import { FEATURES_FILE, STATUS_FOLDER as TEST262_STATUS } from "../../polyfill/test262/driver.ts";
import { STATUS_FOLDER as WPT_STATUS } from "../../polyfill/wpt/driver.ts";

/** The status files under `folder`, from it. */
function statusFiles(folder: string): string[] {
	return fs
		.readdirSync(folder, { recursive: true, encoding: "utf8" })
		.filter((file) => file.endsWith(".json"))
		.sort();
}

describe.each([
	{ suite: "WPT", folder: WPT_STATUS },
	{ suite: "test262", folder: TEST262_STATUS },
])("the $suite status files", ({ folder }) => {
	it.each(statusFiles(folder))("%s is well formed", (file) => {
		const value: unknown = JSON.parse(fs.readFileSync(path.join(folder, file), "utf8"));
		expect(statusProblems(value)).toEqual([]);
	});
});

it("gives each test262 feature the suites skip its reason", () => {
	// Boundary: a JSON object of reasons by feature, checked below.
	const features = JSON.parse(fs.readFileSync(FEATURES_FILE, "utf8")) as Record<string, unknown>;
	const withoutReason = Object.entries(features)
		.filter(([, reason]) => typeof reason !== "string" || reason.trim() === "")
		.map(([feature]) => feature);
	expect(withoutReason).toEqual([]);
});
