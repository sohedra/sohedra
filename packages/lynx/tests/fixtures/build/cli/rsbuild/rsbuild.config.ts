// An app built with Rsbuild's own CLI: the binding's plugin alone, which registers the Lynx build
// engine itself.
import { pluginSvelteLynx } from "@sohedra/lynx/config/rsbuild";

export default {
	source: { entry: { main: "./index.ts" } },
	plugins: [pluginSvelteLynx()],
};
