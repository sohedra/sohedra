import type { PopupView } from "@sohedra/primitives-core/foundation/popup/index.js";

import type { WebTypes } from "../kernel/index.js";
import { waitForAnimations } from "../presence/index.js";

/**
 * When an open popup moves to another trigger, its transitions run once more (repositioning),
 * then `instant: 'trigger-change'` skips them while it stays with that trigger. Core decides when
 * the popup moved and what its instant type is; this waits for the Positioner's animations and
 * tells core when they finished. `popup` is the behaviour's view of the popup; a part passes its
 * store. Call once during the Positioner's init.
 */
export function useTriggerChangeTransition(popup: PopupView<WebTypes>): void {
	popup.activeTrigger.connectTriggerChange((finish) => {
		const positioner = popup.positionerElement as HTMLElement | null;
		if (!positioner) {
			return;
		}
		const controller = new AbortController();
		waitForAnimations(positioner, { signal: controller.signal }, finish);
		return () => controller.abort();
	});
}
