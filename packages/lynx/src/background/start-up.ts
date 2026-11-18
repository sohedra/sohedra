// The first module of every page's background script (the build puts it there): fills in what the
// engine lacks before Svelte's runtime and the page's modules load.

import { fillEngineGaps } from "./engine-gaps.ts";
import { background, globalScope } from "./globals.ts";

fillEngineGaps({ scope: globalScope, strings: String.prototype, globals: background });
