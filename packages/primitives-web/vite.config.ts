import { svelte } from "@sveltejs/vite-plugin-svelte";
import { playwright } from "@vitest/browser-playwright";
import { defineConfig } from "vitest/config";

import { browserCommands } from "./tests/browser-commands.js";

// Two projects: `ssr` runs the `*.ssr.test.ts` files in Node, `browser` the other tests in the
// browsers. `vitest --mode async` compiles with Svelte's `experimental.async`. The browser
// commands are the ones `tests/setup-browser.ts` and `tests/kit/kit-server.ts` call.
export default defineConfig(({ mode }) => ({
	test: {
		setupFiles: ["./tests/setup-reset.ts", ...(mode === "async" ? ["./tests/setup-async.ts"] : [])],
		projects: [
			{
				// Server rendering in Node: what a component's server HTML holds and leaves out.
				// Hydration tests have the server render when they run, through the browser commands.
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
					setupFiles: ["./tests/setup-browser.ts"],
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
