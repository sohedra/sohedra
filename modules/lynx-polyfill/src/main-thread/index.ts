// `@sohedra/lynx-polyfill` on the main thread: the whole baseline (fills/main-thread.ts). Import it
// first in an app's entry, before any module that uses what it fills.

import { fillMainThread } from "../fills/index.ts";

fillMainThread();
