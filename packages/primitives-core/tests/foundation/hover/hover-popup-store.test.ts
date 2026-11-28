// HoverPopupStore: the popup's own hover, which keeps a hover-opened popup open while hovered.
import { describe, expect, it } from "vitest";

import { HoverPopupStore, type HoverView } from "../../../src/foundation/hover/index.js";
import { REASONS } from "../../../src/foundation/kernel/index.js";
import { changeDetails as details } from "../../kit/kit-details.js";
import { createHoverTrigger as setup } from "../../kit/kit-hover.js";
import { event } from "../../kit/kit-stand-ins.js";

describe("HoverPopupStore", () => {
	it("closes a hover-opened popup when the pointer leaves it, but not a click-opened one", () => {
		const { store, scheduler } = setup();
		const popupStore = new HoverPopupStore(() => ({ enabled: true, closeDelay: 30 }), {
			popup: store as unknown as HoverView,
			flush: () => {},
		});
		const into = { enabledTrigger: false, descendant: false };
		store.setOpen(true, details(REASONS.triggerHover, "mouseenter"), { eventType: "mouseenter" });
		popupStore.leave(event("mouseleave"), into);
		scheduler.advance(30);
		expect(store.open).toBe(false);

		store.setOpen(true, details(REASONS.triggerPress, "click"), { eventType: "click" });
		popupStore.leave(event("mouseleave"), into);
		scheduler.advance(30);
		expect(store.open).toBe(true);
	});

	it("treats a press on a popup-opening element inside as click-like", () => {
		const { store } = setup();
		const popupStore = new HoverPopupStore(() => ({ enabled: true, closeDelay: 0 }), {
			popup: store as unknown as HoverView,
			flush: () => {},
		});
		store.setOpen(true, details(REASONS.triggerHover, "mouseenter"), { eventType: "mouseenter" });
		popupStore.pressInside(true, true);
		popupStore.leave(event("mouseleave"), { enabledTrigger: false, descendant: false });
		expect(store.open).toBe(true);
		popupStore.pressInside(true, false);
		popupStore.leave(event("mouseleave"), { enabledTrigger: false, descendant: false });
		expect(store.open).toBe(false);
	});
});
