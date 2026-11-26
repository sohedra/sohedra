import { svelte } from "@sveltejs/vite-plugin-svelte";
import { defineConfig } from "vitest/config";

// The stores run in Node without a DOM, so any DOM access crashes here. Modules are compiled for
// the client (the `browser` condition and the client Vite environment), so `$effect` runs instead
// of being the server no-op. `vitest --mode async` compiles with Svelte's `experimental.async`.
export default defineConfig(({ mode }) => ({
	plugins: [
		svelte({
			configFile: false,
			compilerOptions: { runes: true, experimental: { async: mode === "async" } },
		}),
	],
	resolve: { conditions: ["browser"] },
	test: {
		name: "core",
		environment: "./tests/node-client-environment.ts",
		include: ["tests/**/*.test.ts"],
		setupFiles: [
			"./tests/setup.ts",
			...(mode === "async" ? ["./tests/setup-async.ts"] : []),
			"./tests/core/setup.ts",
		],
	},
}));
