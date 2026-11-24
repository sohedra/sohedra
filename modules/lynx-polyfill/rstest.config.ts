import fs from "node:fs";

import { defineConfig } from "@rstest/core";
import type { RstestConfig } from "@rstest/core";

// The coverage floor: the measured values, rounded down. Coverage may never drop below it; a pull
// request that raises coverage may raise it.
const floor = JSON.parse(
	fs.readFileSync(new URL("./tests/coverage-baseline.json", import.meta.url), "utf8"),
) as Record<"statements" | "branches" | "functions" | "lines", number>;

// The floor holds the whole suite: `pnpm test` here, or from the root. A run given anything else
// measures part of it, so it shows coverage without failing on the floor.
const wholeRun = process.argv.slice(2).every((argument) => argument === "run");

// Tests are grouped by kind (see CONTRIBUTING.md § Tests):
//   unit/      each fill on a global object shaped like a thread's, in Node
//   contract/  the vendored modules, the status files, the feature table and the package
//   primjs/    WPT and test262 on PrimJS, run by their own config (tests/primjs/rstest.config.ts)
const config: RstestConfig = defineConfig({
	testEnvironment: "node",
	include: ["tests/**/*.test.ts"],
	exclude: ["tests/primjs/**"],
	coverage: {
		enabled: true,
		provider: "istanbul",
		include: ["src/**/*.ts"],
		reporters: ["text-summary", "json-summary"],
		...(wholeRun && { thresholds: floor }),
	},
});

export default config;
