// Checked by `pnpm check`, not run. `@sohedra/lynx/config/svelte`: `defineConfig()` takes the
// compiler options an app may set, and preprocessors.

import { defineConfig } from "@sohedra/lynx/config/svelte";
import type { SvelteConfig, SvelteConfigOptions } from "@sohedra/lynx/config/svelte";

const config: SvelteConfig = defineConfig();
const options: SvelteConfigOptions = {
	compilerOptions: {
		cssHash: ({ hash, css }) => `s-${hash(css)}`,
		experimental: { async: true },
		warningFilter: (warning) => warning.code !== "a11y_missing_attribute",
	},
	preprocess: [{ name: "none" }],
};
defineConfig(options);
void config;

// @ts-expect-error runes are always on.
defineConfig({ compilerOptions: { runes: false } });
// @ts-expect-error CSS goes to Lynx's own style sheet, never injected.
defineConfig({ compilerOptions: { css: "injected" } });
// @ts-expect-error the renderer is the binding's.
defineConfig({ compilerOptions: { experimental: { customRenderer: "./renderer.js" } } });
// @ts-expect-error Svelte 4's options do not apply.
defineConfig({ compilerOptions: { accessors: true } });
