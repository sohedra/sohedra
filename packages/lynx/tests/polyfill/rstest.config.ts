// The polyfill folder's suites on PrimJS, apart from the package's own tests: they build PrimJS and
// fetch WPT first (global-setup.ts), which takes a network and a C++ compiler.
// `pnpm -F @sohedra/lynx test:primjs` runs them all; `test:wpt` the WPT suite.

import path from "node:path";

import { defineConfig } from "@rstest/core";
import type { RstestConfig } from "@rstest/core";

const config: RstestConfig = defineConfig({
	root: path.resolve(import.meta.dirname, "../.."),
	name: "primjs",
	testEnvironment: "node",
	include: ["tests/polyfill/**/*.test.ts"],
	globalSetup: ["tests/polyfill/global-setup.ts"],
	// A test is a folder of a suite on an engine and a thread: hundreds of runs of the shell.
	testTimeout: 20 * 60_000,
	hookTimeout: 10 * 60_000,
	coverage: { enabled: false },
});

export default config;
