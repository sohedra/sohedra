// A main-thread ref made at a module's top level: it outlives a page that reloads on the background.

import { mainThreadRef } from "@sohedra/lynx";
import type { MainThreadRef } from "@sohedra/lynx";

export const sharedCount: MainThreadRef<number> = mainThreadRef(0);
