// The portal a part is rendered in. It is one context for the whole page, so a popup nested in
// another finds its parent's portal.

import { defineContext } from "@sohedra/primitives-core/foundation/kernel/index.js";

import type { PortalStore } from "./portal-store.svelte.js";

/** The portal a part is rendered in: a popup's Portal sets its store. */
export const PortalContext = defineContext<PortalStore>(
	"PortalContext",
	"Focus managers read it through `getOr(null)`.",
);
