// Switch's context: defined here, on the web, and typed for the web. Core never reads a context.
import type { SwitchStore } from "@sohedra/primitives-core/components/switch/index.js";
import { defineContext } from "@sohedra/primitives-core/foundation/kernel/index.js";

import type { WebTypes } from "../../foundation/kernel/index.js";

/** The switch a part sits in: Switch.Root sets its store. */
export const SwitchRootContext = defineContext<SwitchStore<WebTypes>>("Switch.Root");
