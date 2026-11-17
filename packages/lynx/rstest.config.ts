import { defineConfig } from "@rstest/core";
import type { RstestConfig } from "@rstest/core";

import { withSvelteLynx } from "./src/build/presets/rstest.ts";

// Tests are grouped by kind, with a subfolder per source area (see CONTRIBUTING.md § Tests):
//   unit/      one module at a time, started no page
//   threads/   both threads of a page on the engine fake
//   contract/  rules about the source, the repository, the pinned Svelte build and the engine
//   types/     checked by `pnpm check`, not run
//   fixtures/  inputs the tests read
//
// The tests of the page, and of the Lynx it runs on, go through the package's own preset: a DOM,
// the engine fake and a cleanup after each test. The rest run in Node.
const onTheTestTree = ["tests/unit/testing/**", "tests/contract/engine/**", "tests/threads/**"];

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
			exclude: onTheTestTree.map((folder) => `${folder}/*.test.ts`),
		},
	],
	coverage: {
		enabled: true,
		provider: "istanbul",
		include: ["src/**/*.ts"],
		reporters: ["text-summary", "json-summary"],
	},
});

export default config;
