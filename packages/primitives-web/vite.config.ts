import { svelte } from "@sveltejs/vite-plugin-svelte";
import { playwright } from "@vitest/browser-playwright";
import { defineConfig } from "vitest/config";

import { browserCommands } from "./tests/browser-commands.js";

// The same projects and modes as the old package, minus `core`, which is `primitives-core`'s own.
// `vitest --mode async` compiles with Svelte's `experimental.async`. The browser commands are the
// ones `tests/browser-setup.ts` calls.
export default defineConfig(({ mode }) => ({
	test: {
		setupFiles: ["./tests/setup.ts", ...(mode === "async" ? ["./tests/setup-async.ts"] : [])],
		projects: [
			{
				// Server rendering: writes the HTML fixtures the browser project hydrates.
				extends: true,
				test: {
					name: "ssr",
					environment: "node",
					include: ["tests/**/*.ssr.test.ts"],
				},
			},
			{
				extends: true,
				test: {
					name: "browser",
					include: ["tests/**/*.test.ts"],
					setupFiles: ["./tests/browser-setup.ts"],
					exclude: [
						"tests/**/*.ssr.test.ts",
						// `*.async.test.ts` render fixtures with `await` in markup, which needs async mode.
						...(mode === "async" ? [] : ["tests/**/*.async.test.ts"]),
					],
					browser: {
						enabled: true,
						headless: true,
						provider: playwright(),
						instances: [{ browser: "chromium" }, { browser: "firefox" }, { browser: "webkit" }],
						commands: browserCommands,
					},
				},
			},
		],
	},
	plugins: [
		svelte({
			compilerOptions: {
				// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes("node_modules") ? undefined : true,
				experimental: { async: mode === "async" },
			},
		}),
	],
}));
