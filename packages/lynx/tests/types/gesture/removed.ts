// Checked by `pnpm check`, not run. Names the gesture entries no longer have: the relations are
// options of each gesture, the gesture's type is `Gesture`, and its element `MainThread.Element`.
// One import for each name, under its own `@ts-expect-error`, so that each must be missing.
/* oxlint-disable import/no-duplicates */

// @ts-expect-error `waitFor` and `continueWith` are options of each gesture, not functions.
import { continueWith, waitFor } from "@sohedra/lynx/experimental";
// @ts-expect-error a gesture's type is `Gesture`; `GestureKind` is the testing entry's string.
import type { GestureKind } from "@sohedra/lynx/gesture";
// @ts-expect-error a gesture's element is `MainThread.Element` of `@sohedra/lynx/elements`.
import type { GestureElement } from "@sohedra/lynx/gesture";

void [waitFor, continueWith];
export type { GestureElement, GestureKind };
