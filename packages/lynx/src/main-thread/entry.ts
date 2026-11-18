// The main thread's runtime, which the build puts first in each page's main-thread script: it fills
// in what the engine lacks, then starts.

import { fillEngineGaps } from "./engine-gaps.ts";
import { globalScope, mainThread } from "./globals.ts";
import { startMainThread } from "./runtime.ts";

fillEngineGaps(globalScope, mainThread.lynx);
startMainThread();
