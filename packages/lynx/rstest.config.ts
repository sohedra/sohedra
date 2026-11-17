import { defineConfig } from "@rstest/core";
import type { RstestConfig } from "@rstest/core";

import { readCoverageBaseline } from "../../scripts/coverage-baseline.ts";

// Tests are grouped by kind, with a subfolder per source area (see CONTRIBUTING.md § Tests):
//   unit/      one module at a time, started no page
//   contract/  rules about the source, the repository and the pinned Svelte build
//   types/     checked by `pnpm check`, not run
//   fixtures/  inputs the tests read
const config: RstestConfig = defineConfig({
	include: ["tests/**/*.test.ts"],
	testEnvironment: "node",
	coverage: {
		enabled: true,
		provider: "istanbul",
		include: ["src/**/*.ts"],
		reporters: ["text-summary", "json-summary"],
		// A run that covers less than the recorded values fails (see scripts/coverage-baseline.ts).
		thresholds: readCoverageBaseline(import.meta.dirname),
	},
});

export default config;
