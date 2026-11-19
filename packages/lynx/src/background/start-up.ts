// The first module of every page's background script (the build puts it there): fills in what the
// engine lacks before Svelte's runtime and the page's modules load, and gives the bundler's chunk
// loader its loader of lazy bundles, which a module-level `import()` calls before the page starts.

import { fillEngineGaps } from "./engine-gaps.ts";
import { background, globalScope } from "./globals.ts";
import { installLazyBundles } from "./lazy-bundle.ts";

fillEngineGaps({ scope: globalScope, strings: String.prototype, globals: background });
installLazyBundles();
