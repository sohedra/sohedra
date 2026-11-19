// The Vitest preset's own tests: the library tests (tests/library/) run under Vitest through
// `svelteLynx()`, as under Rstest, with `@rstest/core` standing for Vitest's functions; and a
// project for each row of the parity table that the library tests do not cover. The binding's
// Rstest suite starts this run (tests/build/vitest-run.test.ts).

import { fileURLToPath } from "node:url";

import { svelteLynx } from "@sohedra/lynx/config/vitest";
import { defineConfig } from "vitest/config";
import type { ViteUserConfig } from "vitest/config";

const own = (file: string) => fileURLToPath(new URL(file, import.meta.url));

const config: ViteUserConfig = defineConfig({
	test: {
		projects: [
			{
				plugins: [svelteLynx()],
				resolve: { alias: { "@rstest/core": own("./rstest-core-as-vitest.ts") } },
				test: { name: "library", include: ["tests/library/**/*.test.ts"] },
			},
			{
				plugins: [
					svelteLynx({
						define: {
							mainThread: { __APP_THREAD__: JSON.stringify("from the main thread") },
							background: { __APP_THREAD__: JSON.stringify("from the background") },
						},
					}),
				],
				test: { name: "options", include: ["tests/vitest/options.test.ts"] },
			},
			{
				plugins: [svelteLynx({ firstFrame: false })],
				test: { name: "no-first-frame", include: ["tests/vitest/no-first-frame.test.ts"] },
			},
			{
				plugins: [svelteLynx()],
				test: { name: "errors", include: ["tests/vitest/errors.test.ts"] },
			},
			{
				plugins: [svelteLynx()],
				test: { name: "syntax", include: ["tests/vitest/syntax.test.ts"] },
			},
		],
	},
});

export default config;
