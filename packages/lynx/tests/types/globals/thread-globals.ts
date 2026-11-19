// Checked by `pnpm check`, not run. Each thread's typed globals have what that thread has and no
// more, so a main-thread call from the background fails to compile.

import { background } from "../../../src/background/globals.ts";
import { firstFrame } from "../../../src/first-frame/globals.ts";
import { mainThread } from "../../../src/main-thread/globals.ts";

background.lynx.reportError(new Error("reported"));
background.lynx.queueMicrotask(() => {});
// @ts-expect-error Lynx's element functions exist on the main thread only.
background.__FlushElementTree();

mainThread.lynx.reportError(new Error("reported"));
mainThread.__FlushElementTree();
// @ts-expect-error the main thread's `lynx` has no `queueMicrotask`.
mainThread.lynx.queueMicrotask(() => {});

firstFrame.lynx.reportError(new Error("reported"));
// @ts-expect-error the first frame is not the main-thread runtime and has no element functions.
firstFrame.__FlushElementTree();
