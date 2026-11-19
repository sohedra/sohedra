// An app built with Rsbuild's own CLI: the binding's plugin alone, which registers the Lynx build
// engine itself, and Rsbuild's build cache. `compiled.cjs` is the test's probe of the cache.
import { fileURLToPath } from "node:url";

import { pluginSvelteLynx } from "@sohedra/lynx/config/rsbuild";

export default {
	source: { entry: { main: "./index.ts" } },
	performance: { buildCache: true },
	plugins: [pluginSvelteLynx()],
	tools: {
		rspack: {
			module: {
				rules: [
					{
						test: /App\.svelte$/,
						enforce: "pre",
						loader: fileURLToPath(new URL("compiled.cjs", import.meta.url)),
					},
				],
			},
		},
	},
};
