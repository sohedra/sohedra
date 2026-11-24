// Checked by `pnpm check`, not run. The one runtime class of a main-thread element is what
// `MainThread.Element` of `@sohedra/lynx/elements` promises: the declarations follow the runtime.

import type { MainThread } from "@sohedra/lynx/elements";

import type { MainThreadElement } from "../../../src/main-thread/functions/element.ts";

export const element = (runtime: MainThreadElement): MainThread.Element => runtime;
export const animation = (runtime: MainThreadElement): MainThread.Animation =>
	runtime.animate([{ opacity: 0 }], 200);
