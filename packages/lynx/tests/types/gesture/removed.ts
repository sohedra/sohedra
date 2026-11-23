// Checked by `pnpm check`, not run. Names the gesture entries no longer have: the relations are
// options of each gesture, and the gesture's type is `Gesture`.

// @ts-expect-error `waitFor` and `continueWith` are options of each gesture, not functions.
import { continueWith, waitFor } from "@sohedra/lynx/experimental";
// @ts-expect-error a gesture's type is `Gesture`; `GestureKind` is the testing entry's string.
import type { GestureKind } from "@sohedra/lynx/gesture";

void [waitFor, continueWith];
export type { GestureKind };
