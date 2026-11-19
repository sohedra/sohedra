// Checked by `pnpm check`, not run. `@sohedra/lynx/config/rstest`: the preset that runs an app's
// tests on the engine fake, with the plugin's options or from the app's build config file.

import { defineConfig } from "@rstest/core";
import type { ExtendConfigFn } from "@rstest/core";
import { withSvelteLynx, withSvelteLynxFromConfig } from "@sohedra/lynx/config/rstest";
import type { ConfigFileOptions } from "@sohedra/lynx/config/rstest";

const preset: ExtendConfigFn = withSvelteLynx({ firstFrame: false });
const fromFile: ExtendConfigFn = withSvelteLynxFromConfig({ configPath: "lynx.config.ts" });
const options: ConfigFileOptions = { rootPath: "apps/shop" };
defineConfig({ extends: withSvelteLynxFromConfig(options) });
void [preset, fromFile];

// @ts-expect-error the preset takes the plugin's options, not Rstest's.
withSvelteLynx({ testEnvironment: "node" });
// @ts-expect-error the config file is a path.
withSvelteLynxFromConfig({ configPath: true });
