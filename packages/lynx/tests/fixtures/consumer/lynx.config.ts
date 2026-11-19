// An app as `scripts/consumer.ts` installs it: the packed binding from a package manager, built by
// rspeedy, and tested with both test presets from this config.
import { defineConfig } from "@lynx-js/rspeedy";
import { pluginSvelteLynx } from "@sohedra/lynx/config/rsbuild";

export default defineConfig({
	source: { entry: { main: "./src/index.ts" } },
	plugins: [pluginSvelteLynx()],
});
