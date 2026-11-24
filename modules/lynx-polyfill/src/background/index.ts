// `@sohedra/lynx-polyfill` on the background thread: the whole baseline (fills/background.ts).
// Import it first in an app's entry, before any module that uses what it fills.

import { fillBackground } from "../fills/index.ts";

fillBackground();
