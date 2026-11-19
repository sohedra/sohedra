import { svelteLynxFromConfig } from "@sohedra/lynx/config/vitest";
import { defineConfig } from "vitest/config";

export default defineConfig({
	plugins: [svelteLynxFromConfig()],
	test: { include: ["tests/vitest/**/*.test.ts"] },
});
