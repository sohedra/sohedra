import { pluginSvelteLynx } from "../../../../../src/build/plugin/index.ts";

// An app's config: the plugin with its options among the others, an alias and a constant of its own.
export default {
	resolve: { alias: { "~": "./src" } },
	source: { define: { __APP__: JSON.stringify("app") } },
	plugins: [
		[{ name: "an-app-plugin", setup() {} }],
		pluginSvelteLynx({ firstFrame: false, singleCopy: ["@app/ui"] }),
	],
};
