import fs from "node:fs";

import { defineConfig } from "@rstest/core";
import type { RstestConfig } from "@rstest/core";

import { withSvelteLynx } from "./src/build/presets/rstest.ts";

// The coverage floor: the measured values, rounded down. Coverage may never drop below it; a pull
// request that raises coverage may raise it.
const floor = JSON.parse(
	fs.readFileSync(new URL("./tests/coverage-baseline.json", import.meta.url), "utf8"),
) as Record<"statements" | "branches" | "functions" | "lines", number>;

// The floor holds the whole suite: `pnpm test` here, or from the root. A run given anything else
// (a file, a project, a test name, `--coverage.enabled=false`) measures part of it, so it shows
// coverage without failing on the floor. Rstest reads its arguments from the command line it was
// started with, as this does.
const wholeRun = process.argv.slice(2).every((argument) => argument === "run");

// Tests are grouped by kind, with a subfolder per source area (see CONTRIBUTING.md § Tests):
//   threads/   both threads of a page on the engine fake
//   unit/      one module at a time; those of `src/testing` and of the threads' programs on the
//              engine fake
//   build/     production, development and CLI builds of the fixture apps, and the size budgets
//   library/   components tested through `@sohedra/lynx/testing`, as a component library would
//   contract/  rules about the source, the repository, the pinned Svelte build, and the engine
//              behavior spec run on the fake
//   types/     checked by `pnpm check`, not run
//   vitest/    the Vitest preset's own projects, which Vitest runs
//   dev-text/  the scanner of the text only development builds may hold, which a contract test runs
//   fixtures/  inputs the tests read (the app of scripts/consumer.ts has tests of its own)
//
// The tests of the page, and of the Lynx it runs on, go through the package's own preset: a DOM,
// the engine fake and a cleanup after each test. The rest run in Node.
const onTheTestTree = [
	"tests/unit/testing/**",
	"tests/unit/background/**",
	"tests/unit/first-frame/**",
	"tests/unit/globals/**",
	"tests/unit/main-thread/**",
	"tests/contract/engine/**",
	"tests/threads/**",
	"tests/library/**",
];

const config: RstestConfig = defineConfig({
	projects: [
		{
			name: "page",
			extends: withSvelteLynx(),
			include: onTheTestTree.map((folder) => `${folder}/*.test.ts`),
		},
		{
			name: "node",
			testEnvironment: "node",
			include: ["tests/**/*.test.ts"],
			// The run's folder of the builds the build tests share.
			globalSetup: ["tests/build/global-setup.ts"],
			// The Vitest preset's suite runs under Vitest (tests/build/vitest-run.test.ts), and the
			// fixture app's tests in the app that scripts/consumer.ts installs.
			exclude: [
				...onTheTestTree.map((folder) => `${folder}/*.test.ts`),
				"tests/vitest/**",
				"tests/fixtures/**",
			],
		},
	],
	// Node loads Svelte's server runtime unless told otherwise; the contract tests load the client
	// runtime and compiled components with Node itself, as Svelte's docs on custom renderers say.
	pool: { execArgv: ["--conditions=svelte-custom-renderer"] },
	coverage: {
		enabled: true,
		provider: "istanbul",
		include: ["src/**/*.ts"],
		reporters: ["text-summary", "json-summary"],
		...(wholeRun && { thresholds: floor }),
	},
});

export default config;
