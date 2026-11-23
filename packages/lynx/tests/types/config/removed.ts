// Checked by `pnpm check`, not run. Names the config entries do not export: what only the Vitest
// preset and the package's own tests read.

// @ts-expect-error the plugin's registry key is the Vitest preset's, not an app's.
import { PLUGIN_OPTIONS } from "@sohedra/lynx/config/rsbuild";
// @ts-expect-error the Svelte config's function is `defineConfig`, as the ecosystem names it.
import { svelteConfig } from "@sohedra/lynx/config/svelte";
// @ts-expect-error the key of Vitest's module cache is the preset's own.
import { cacheKey } from "@sohedra/lynx/config/vitest";

void [PLUGIN_OPTIONS, cacheKey, svelteConfig];
