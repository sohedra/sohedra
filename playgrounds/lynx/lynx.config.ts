// The playground's build: rspeedy, the Lynx build engine's own CLI, with the Svelte plugin.
// `pnpm build` writes `dist/main.lynx.bundle`; `pnpm dev` serves it to Lynx Explorer and prints a
// QR code of the bundle's address to scan with it.

import { pluginQRCode } from "@lynx-js/qrcode-rsbuild-plugin";
import { defineConfig } from "@lynx-js/rspeedy";
import { pluginSvelteLynx } from "@sohedra/lynx/config/rsbuild";

export default defineConfig({
	source: { entry: { main: "./src/index.ts" } },
	plugins: [
		pluginQRCode({
			// Lynx Explorer opens the page without its own toolbar.
			schema: (url) => `${url}?fullscreen=true`,
		}),
		pluginSvelteLynx(),
	],
});
