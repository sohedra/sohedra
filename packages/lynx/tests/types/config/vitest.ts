// Checked by `pnpm check`, not run. `@sohedra/lynx/config/vitest`: the preset that runs an app's
// tests under Vitest, with the plugin's options or from the app's build config file.

import { svelteLynx, svelteLynxFromConfig } from "@sohedra/lynx/config/vitest";
import type { ConfigFileOptions } from "@sohedra/lynx/config/vitest";
import type { Plugin } from "vite";
import { defineConfig } from "vitest/config";

const plugins: Plugin[] = svelteLynx({ firstFrame: false, dedupe: ["@app/ui"] });
defineConfig({ plugins });
defineConfig({ plugins: svelteLynx() });

export async function fromConfig(): Promise<void> {
	const found: Promise<Plugin[]> = svelteLynxFromConfig({ configPath: "lynx.config.ts" });
	defineConfig({ plugins: await found });
	defineConfig({ plugins: await svelteLynxFromConfig() });
	const options: ConfigFileOptions = { rootPath: "apps/shop" };
	defineConfig({ plugins: await svelteLynxFromConfig(options) });
}

// @ts-expect-error the preset takes the plugin's options, not Vitest's.
svelteLynx({ environment: "jsdom" });
// @ts-expect-error the config file is a path.
void svelteLynxFromConfig({ configPath: true });
