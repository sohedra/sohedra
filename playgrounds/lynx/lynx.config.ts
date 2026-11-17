// The playground's build: rspeedy, the Lynx build engine's own CLI, with the Svelte plugin.
// `pnpm build` writes `dist/main.lynx.bundle`; `pnpm dev` serves it to Lynx Explorer.

import { defineConfig } from "@lynx-js/rspeedy";
import { pluginSvelteLynx } from "@sohedra/lynx/config/rsbuild";

export default defineConfig({
	source: { entry: { main: "./src/index.ts" } },
	plugins: [pluginSvelteLynx()],
});
