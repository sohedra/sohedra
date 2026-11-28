// HoverTriggerStore: a trigger's hover opening and closing a popup with its delays, rest and safe
// polygon.
import { flushSync } from "svelte";
import { describe, expect, it } from "vitest";

import {
	HoverTriggerStore,
	type HoverView,
	SafePolygonSession,
} from "../../../src/foundation/hover/index.js";
import { REASONS } from "../../../src/foundation/kernel/index.js";
import { initialPosition, PositionerStore } from "../../../src/foundation/position/index.js";
import { changeDetails as details } from "../../kit/kit-details.js";
import { createHoverTrigger as setup, hoverTriggerProps as config } from "../../kit/kit-hover.js";
import { event } from "../../kit/kit-stand-ins.js";

describe("HoverTriggerStore", () => {
	it("opens after the open delay, and flushes the commit", () => {
		const { store, triggerStore, target, flush, scheduler } = setup({ delay: { open: 100 } });
		triggerStore.enter(event("mouseenter"), target);
		expect(store.open).toBe(false);
		scheduler.advance(100);
		expect(store.open).toBe(true);
		expect(store.openChangeReason).toBe(REASONS.triggerHover);
		expect(flush).toHaveBeenCalled();
	});

	it("opens only after the pointer rests with a rest-only delay", () => {
		const { store, triggerStore, target, scheduler } = setup({ restMs: 50 });
		triggerStore.enter(event("mouseenter"), target);
		scheduler.advance(100);
		expect(store.open).toBe(false);
		triggerStore.move(event("mousemove"), target, 2, 0);
		scheduler.advance(49);
		expect(store.open).toBe(false);
		// Small moves don't restart a pending rest.
		triggerStore.move(event("mousemove"), target, 1, 0);
		scheduler.advance(1);
		expect(store.open).toBe(true);
	});

	it("doesn't let a pending rest open override a click open made meanwhile", () => {
		const { store, triggerStore, target, onOpenChange, scheduler } = setup({ restMs: 50 });
		triggerStore.enter(event("mouseenter"), target);
		triggerStore.move(event("mousemove"), target, 2, 0);
		store.setOpen(true, details(REASONS.triggerPress, "click"), { eventType: "click" });
		scheduler.advance(50);
		expect(onOpenChange).toHaveBeenCalledTimes(1);
		expect(store.openEventType).toBe("click");
	});

	it("ignores non-mouse pointers when mouse-only", () => {
		const { store, triggerStore, target } = setup();
		triggerStore.pointerType("touch");
		triggerStore.enter(event("mouseenter"), target);
		expect(store.open).toBe(false);
	});

	it("closes after the close delay when leaving, and the delay dies with the hover state", () => {
		const { store, triggerStore, target, leave, scheduler } = setup({ delay: { close: 100 } });
		triggerStore.enter(event("mouseenter"), target);
		expect(store.open).toBe(true);
		triggerStore.leave(event("mouseleave"), leave);
		scheduler.advance(99);
		expect(store.open).toBe(true);
		scheduler.advance(1);
		expect(store.open).toBe(false);

		triggerStore.enter(event("mouseenter"), target);
		triggerStore.leave(event("mouseleave"), leave);
		store.hover.stop();
		scheduler.advance(200);
		expect(store.open).toBe(true);
	});

	it("keeps a touch-hovered popup open when the pointer moves into it", () => {
		const { store, triggerStore, target, leave } = setup({ mouseOnly: false });
		triggerStore.pointerType("touch");
		triggerStore.enter(event("mouseenter"), target);
		expect(store.open).toBe(true);
		triggerStore.leave(event("mouseleave"), { ...leave, intoPopup: true });
		expect(store.open).toBe(true);
		triggerStore.leave(event("mouseleave"), leave);
		expect(store.open).toBe(false);
	});

	it("doesn't close a click-opened popup on leave", () => {
		const { store, triggerStore, leave } = setup();
		store.setOpen(true, details(REASONS.triggerPress, "click"), { eventType: "click" });
		triggerStore.leave(event("mouseleave"), leave);
		expect(store.open).toBe(true);
	});

	it("reopens at once when re-entering during a hover close", () => {
		const { store, triggerStore, target, leave } = setup({ restMs: 50 });
		store.setOpen(true, details(REASONS.triggerHover, "mouseenter"), { eventType: "mouseenter" });
		flushSync();
		store.events.on("openchange", (d) => triggerStore.openChanged(d));
		triggerStore.leave(event("mouseleave"), leave);
		flushSync();
		expect(store.open).toBe(false);
		expect(store.transitionStatus).toBe("ending");
		triggerStore.enter(event("mouseenter"), target);
		expect(store.open).toBe(true);
	});

	it("starts a safe polygon on leave once the Positioner reports a side", () => {
		const { store, target, leave } = setup();
		const triggerStore = new HoverTriggerStore(() => config({ safePolygon: true }), {
			popup: () => store as unknown as HoverView,
			flush: () => {},
		});
		triggerStore.enter(event("mouseenter"), target);
		expect(triggerStore.leave(event("mouseleave"), leave)).toBeUndefined();
		expect(store.open).toBe(false);

		triggerStore.enter(event("mouseenter"), target);
		store.positionerClaim.claim(
			{},
			new PositionerStore(() => ({ keepMounted: false }), {
				initial: initialPosition({ side: "bottom", align: "center", rtl: false }),
				popup: store,
			}),
		);
		expect(triggerStore.leave(event("mouseleave"), leave)).toBeInstanceOf(SafePolygonSession);
		expect(store.open).toBe(true);
	});
});
