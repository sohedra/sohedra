// An app built with rspeedy's CLI, for development: the dev client and hot reload are in.
import { pluginSvelteLynx } from "@sohedra/lynx/config/rsbuild";

export default {
	source: { entry: { main: "./index.ts" } },
	plugins: [pluginSvelteLynx()],
};
