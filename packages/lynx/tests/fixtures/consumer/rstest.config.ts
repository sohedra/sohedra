import { defineConfig } from "@rstest/core";
import { withSvelteLynxFromConfig } from "@sohedra/lynx/config/rstest";

export default defineConfig({
	extends: withSvelteLynxFromConfig(),
	include: ["tests/rstest/**/*.test.ts"],
});
