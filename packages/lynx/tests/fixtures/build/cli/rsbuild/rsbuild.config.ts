// An app built with Rsbuild's own CLI: the binding's plugin alone, which registers the Lynx build
// engine itself, and Rsbuild's build cache.
import { pluginSvelteLynx } from "@sohedra/lynx/config/rsbuild";

export default {
	source: { entry: { main: "./index.ts" } },
	performance: { buildCache: true },
	plugins: [pluginSvelteLynx()],
};
