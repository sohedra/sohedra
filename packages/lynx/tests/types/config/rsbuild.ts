// Checked by `pnpm check`, not run. `@sohedra/lynx/config/rsbuild`: the plugin takes build options
// only, each typed; Svelte's options come from `svelte.config.js`.

import type { RsbuildPlugin } from "@rsbuild/core";
import { pluginSvelteLynx } from "@sohedra/lynx/config/rsbuild";
import type { PluginSvelteLynxOptions } from "@sohedra/lynx/config/rsbuild";

const plugin: RsbuildPlugin = pluginSvelteLynx();
const options: PluginSvelteLynxOptions = {
	engineVersion: "3.4",
	firstFrame: (entry) => entry !== "settings",
	define: { mainThread: { __FLAG__: true }, background: { API: JSON.stringify("https://x") } },
	dedupe: ["some-store"],
	pageConfig: { enableFiberArch: true },
	svelte: { configFile: "svelte.lynx.config.js" },
};
pluginSvelteLynx(options);
void plugin;

// @ts-expect-error Svelte's compiler options belong in svelte.config.js.
pluginSvelteLynx({ compilerOptions: { runes: true } });
// @ts-expect-error nor do its preprocessors.
pluginSvelteLynx({ preprocess: [] });
// @ts-expect-error the engine version is text, `"3.4"`.
pluginSvelteLynx({ engineVersion: 3.4 });
// @ts-expect-error a define is replaced on one thread or the other.
pluginSvelteLynx({ define: { __FLAG__: true } });
