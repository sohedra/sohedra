// HoverInteraction: one popup's hover timers and close tracker, and hovering after the app closed
// the popup itself: a bound `open` set to false from outside passes no request, so nothing clears
// the recorded open event (a reopen from outside still needs it) and no open-change event reaches
// the triggers.
import { flushSync } from "svelte";
import { describe, expect, it, vi } from "vitest";

import { PATIENT_CLICK_THRESHOLD } from "../../../src/components/popover/index.js";
import {
	HoverInteraction,
	HoverPopupStore,
	SafePolygonSession,
} from "../../../src/foundation/hover/index.js";
import { REASONS } from "../../../src/foundation/kernel/index.js";
import { initialPosition, PositionerStore } from "../../../src/foundation/position/index.js";
import { changeDetails as details } from "../../kit/kit-details.js";
import { createFakePlatform } from "../../kit/kit-fake-platform.js";
import { createHoverTriggerWithAppOpen as setupWithAppOpen } from "../../kit/kit-hover.js";
import { createPopover } from "../../kit/kit-popover.svelte.js";
import { event } from "../../kit/kit-stand-ins.js";

describe("HoverInteraction", () => {
	describe("cancelPendingOpen", () => {
		it("drops a pending delayed open and a pending rest open in one call", () => {
			const { scheduler } = createFakePlatform();
			const hover = new HoverInteraction({ scheduler });
			const callback = vi.fn();
			hover.openChangeTimeout.start(100, callback);
			hover.restTimeout.start(100, callback);
			hover.setRestTimeoutPending(true);
			hover.cancelPendingOpen();
			scheduler.advance(200);
			expect(callback).not.toHaveBeenCalled();
			expect(hover.restTimeoutPending).toBe(false);
		});
	});

	describe("cancelPending", () => {
		it("drops a delayed change, a rest open and the safe polygon", () => {
			const { scheduler: time } = createFakePlatform();
			const hover = new HoverInteraction({ scheduler: time });
			const callback = vi.fn();
			const dispose = vi.fn();
			hover.openChangeTimeout.start(100, callback);
			hover.restTimeout.start(100, callback);
			hover.setRestTimeoutPending(true);
			hover.setCloseTracker({ handler: () => {}, stop: dispose });

			hover.cancelPending();
			time.advance(200);

			expect(callback).not.toHaveBeenCalled();
			expect(hover.restTimeoutPending).toBe(false);
			expect(dispose).toHaveBeenCalledTimes(1);
			expect(hover.handler).toBeUndefined();
		});
	});

	describe("closedFromOutside", () => {
		it("drops what is pending as cancelPending does, and ignores pointer moves until an enter", () => {
			const { scheduler: time } = createFakePlatform();
			const hover = new HoverInteraction({ scheduler: time });
			const callback = vi.fn();
			const dispose = vi.fn();
			hover.setMouseMoveBlocked(false);
			hover.openChangeTimeout.start(100, callback);
			hover.restTimeout.start(100, callback);
			hover.setRestTimeoutPending(true);
			hover.setCloseTracker({ handler: () => {}, stop: dispose });

			hover.closedFromOutside();
			time.advance(200);

			expect(callback).not.toHaveBeenCalled();
			expect(hover.restTimeoutPending).toBe(false);
			expect(dispose).toHaveBeenCalledTimes(1);
			expect(hover.handler).toBeUndefined();
			expect(hover.blockMouseMove).toBe(true);
		});
	});

	it("starts without a tracker", () => {
		expect(
			new HoverInteraction({ scheduler: createFakePlatform().scheduler }).handler,
		).toBeUndefined();
	});

	it("forgets the pointer and the inside press once closed", () => {
		const { store } = createPopover({ defaultOpen: true });
		store.hover.setPointerType("touch");
		store.hover.setInteractedInside(true);
		store.setOpen(false, details(REASONS.outsidePress));
		flushSync();
		expect(store.hover.pointerType).toBeUndefined();
		expect(store.hover.interactedInside).toBe(false);
	});
});

describe("a close from outside", () => {
	describe("hovering again", () => {
		it("opens again on hover after a click-opened popup was closed from outside", () => {
			const { store, hover, press, close, leave, triggerStore, scheduler } = setupWithAppOpen();
			press();
			expect(store.open).toBe(true);
			// Pinned by the click: leaving the trigger doesn't close it.
			triggerStore.leave(event("mouseleave"), leave);
			expect(store.open).toBe(true);

			close();
			expect(store.open).toBe(false);
			// The open event is kept: a reopen from outside still relies on it.
			expect(store.openEventType).toBe("click");

			hover();
			scheduler.advance(50);
			expect(store.open).toBe(true);
			expect(store.openChangeReason).toBe(REASONS.triggerHover);
			expect(store.openEventType).toBe("mousemove");
		});

		it("opens again on hover after a click pinned a hover-opened popup", () => {
			const { store, hover, press, close, scheduler } = setupWithAppOpen();
			hover();
			scheduler.advance(50);
			expect(store.open).toBe(true);
			// A press inside the patient-click window keeps it open and takes over the open event.
			scheduler.advance(PATIENT_CLICK_THRESHOLD - 1);
			press();
			expect(store.open).toBe(true);
			expect(store.openEventType).toBe("click");

			close();
			hover();
			scheduler.advance(50);
			expect(store.open).toBe(true);
		});

		it("opens again on every hover, not only the first one after the close", () => {
			const { store, hover, press, close, scheduler } = setupWithAppOpen();
			press();
			close();
			hover();
			scheduler.advance(50);
			expect(store.open).toBe(true);
			close();
			hover();
			scheduler.advance(50);
			expect(store.open).toBe(true);
		});

		it("lets a hover-opened popup close on leave after an earlier click-open was closed from outside", () => {
			const { store, hover, press, close, triggerStore, leave, scheduler } = setupWithAppOpen();
			press();
			close();
			hover();
			scheduler.advance(50);
			expect(store.open).toBe(true);
			triggerStore.leave(event("mouseleave"), leave);
			expect(store.open).toBe(false);
		});

		it("keeps a click-opened popup pinned once it is reopened from outside", () => {
			const { store, press, close, reopen, triggerStore, target, leave, scheduler } =
				setupWithAppOpen();
			press();
			close();
			reopen();
			expect(store.open).toBe(true);
			expect(store.openEventType).toBe("click");

			// Open again and still held by its click: hovering in and out changes nothing.
			triggerStore.enter(event("mouseenter"), target);
			triggerStore.leave(event("mouseleave"), leave);
			scheduler.advance(100);
			expect(store.open).toBe(true);
		});

		it("keeps a hover-opened popup open on a trigger press after a reopen from outside", () => {
			const { store, hover, close, reopen, scheduler } = setupWithAppOpen();
			hover();
			scheduler.advance(50);
			// The patient-click window ends while open.
			scheduler.advance(PATIENT_CLICK_THRESHOLD);
			close();
			// Its exit finished: the next opening starts with a fresh patient-click window.
			store.unmount();
			reopen();
			// The hover that opened it is still on record, so a press keeps it open.
			expect(store.openEventType).toBe("mousemove");
			expect(store.pressOpen(true)).toBe(true);
		});

		it("doesn't close a popup pinned from inside when the pointer leaves it, only while open", () => {
			const { store, view, hover, close, scheduler } = setupWithAppOpen();
			const popup = new HoverPopupStore(() => ({ enabled: true, closeDelay: 0 }), {
				popup: view,
				flush: flushSync,
			});
			hover();
			scheduler.advance(50);
			popup.pressInside(true, true);
			popup.leave(event("mouseleave"), { enabledTrigger: false, descendant: false });
			expect(store.open).toBe(true);

			close();
			// Closed: the inside press no longer counts, and the next hover opens.
			expect(store.hover.interactedInside).toBe(false);
			hover();
			scheduler.advance(50);
			expect(store.open).toBe(true);
		});
	});

	describe("with the pointer resting on the trigger", () => {
		it("keeps a hover-opened popup closed until the pointer leaves and enters again", () => {
			const { store, hover, close, triggerStore, target, leave, onOpenChange, scheduler } =
				setupWithAppOpen();
			hover();
			scheduler.advance(50);
			expect(store.open).toBe(true);

			close();
			onOpenChange.mockClear();
			// The pointer never left: moves alone must not reopen it, however often they come.
			triggerStore.move(event("mousemove"), target, 2, 0);
			scheduler.advance(50);
			triggerStore.move(event("mousemove"), target, 20, 0);
			scheduler.advance(50);
			expect(store.open).toBe(false);
			expect(onOpenChange).not.toHaveBeenCalled();

			triggerStore.leave(event("mouseleave"), leave);
			hover();
			scheduler.advance(50);
			expect(store.open).toBe(true);
			expect(store.openChangeReason).toBe(REASONS.triggerHover);
		});

		it("keeps a click-opened popup closed until the pointer leaves and enters again", () => {
			const { store, hover, press, close, triggerStore, target, leave, onOpenChange, scheduler } =
				setupWithAppOpen();
			// The pointer is on the trigger when it is pressed.
			triggerStore.enter(event("mouseenter"), target);
			press();
			expect(store.open).toBe(true);

			close();
			onOpenChange.mockClear();
			triggerStore.move(event("mousemove"), target, 2, 0);
			scheduler.advance(50);
			triggerStore.move(event("mousemove"), target, 20, 0);
			scheduler.advance(50);
			expect(store.open).toBe(false);
			expect(onOpenChange).not.toHaveBeenCalled();

			triggerStore.leave(event("mouseleave"), leave);
			hover();
			scheduler.advance(50);
			expect(store.open).toBe(true);
			expect(store.openChangeReason).toBe(REASONS.triggerHover);
		});
	});

	describe("after a requested close the app undid in the same update", () => {
		it("doesn't let that close stand in for a later close from outside", () => {
			const { store, hover, close, writeOpen, triggerStore, leave, onOpenChange, scheduler } =
				setupWithAppOpen({
					delay: { close: 100 },
				});
			hover();
			scheduler.advance(50);
			expect(store.open).toBe(true);

			// Escape closes the popup, and before effects run the app sets `open` back.
			store.setOpen(false, details(REASONS.escapeKey, "keydown"));
			writeOpen(true);
			flushSync();
			expect(store.open).toBe(true);
			onOpenChange.mockClear();

			triggerStore.leave(event("mouseleave"), leave);
			scheduler.advance(40);
			close();

			scheduler.advance(200);
			expect(onOpenChange).not.toHaveBeenCalled();
		});
	});

	describe("with hover changes pending", () => {
		it("drops a rest open that was pending, so the popup isn't opened again", () => {
			const { store, hover, close, reopen, onOpenChange, scheduler } = setupWithAppOpen({
				restMs: 100,
			});
			// The pointer rests on the trigger; before the rest ends the app opens and closes the popup.
			hover();
			scheduler.advance(40);
			reopen();
			close();

			scheduler.advance(200);
			expect(store.open).toBe(false);
			expect(onOpenChange).not.toHaveBeenCalled();
		});

		it("drops a delayed open that was pending", () => {
			const { store, triggerStore, target, close, reopen, onOpenChange, scheduler } =
				setupWithAppOpen({
					restMs: 0,
					delay: { open: 100 },
				});
			triggerStore.enter(event("mouseenter"), target);
			scheduler.advance(40);
			reopen();
			close();

			scheduler.advance(200);
			expect(store.open).toBe(false);
			expect(onOpenChange).not.toHaveBeenCalled();
		});

		it("drops a delayed hover close, so no close is reported for a popup already closed", () => {
			const { store, hover, close, triggerStore, leave, onOpenChange, scheduler } =
				setupWithAppOpen({
					delay: { close: 100 },
				});
			hover();
			scheduler.advance(50);
			expect(store.open).toBe(true);
			onOpenChange.mockClear();

			triggerStore.leave(event("mouseleave"), leave);
			scheduler.advance(40);
			close();

			scheduler.advance(200);
			expect(onOpenChange).not.toHaveBeenCalled();
		});

		it("drops the safe polygon, so a later pointer move reports no close", () => {
			const { store, hover, close, triggerStore, leave, onOpenChange, scheduler } =
				setupWithAppOpen({
					safePolygon: true,
				});
			store.positionerClaim.claim(
				{},
				new PositionerStore(() => ({ keepMounted: false }), {
					initial: initialPosition({ side: "bottom", align: "center", rtl: false }),
					popup: store,
				}),
			);
			hover();
			scheduler.advance(50);
			expect(store.open).toBe(true);
			onOpenChange.mockClear();

			const session = triggerStore.leave(event("mouseleave"), leave);
			expect(session).toBeInstanceOf(SafePolygonSession);
			const dispose = vi.fn();
			store.hover.setCloseTracker({ handler: () => {}, stop: dispose });

			close();
			expect(dispose).toHaveBeenCalledTimes(1);
			expect(store.hover.handler).toBeUndefined();
			expect(onOpenChange).not.toHaveBeenCalled();
		});

		it("reports no hover close when the pointer leaves the popup after a close from outside", () => {
			const { store, view, hover, close, onOpenChange, scheduler } = setupWithAppOpen();
			const popup = new HoverPopupStore(() => ({ enabled: true, closeDelay: 30 }), {
				popup: view,
				flush: flushSync,
			});
			hover();
			scheduler.advance(50);
			expect(store.open).toBe(true);
			onOpenChange.mockClear();

			// The pointer is over the popup when the app closes it, then leaves the closed popup.
			popup.enter();
			close();
			popup.leave(event("mouseleave"), { enabledTrigger: false, descendant: false });
			scheduler.advance(100);
			expect(onOpenChange).not.toHaveBeenCalled();
		});

		it("leaves a hover started right after a requested close alone", () => {
			const { store, hover, press, scheduler } = setupWithAppOpen();
			press();
			// A close through the pipeline already told the triggers; the bookkeeping that follows
			// `open` runs later and must not take the new rest with it.
			store.setOpen(false, details(REASONS.outsidePress, "pointerdown"));
			hover();
			flushSync();

			scheduler.advance(50);
			expect(store.open).toBe(true);
			expect(store.openChangeReason).toBe(REASONS.triggerHover);
		});

		it("drops a delayed hover close when the app ignored an earlier close request", () => {
			const { store, hover, close, declined, triggerStore, leave, onOpenChange, scheduler } =
				setupWithAppOpen({
					delay: { close: 100 },
				});
			hover();
			scheduler.advance(50);
			expect(store.open).toBe(true);
			// The app keeps the popup open on Escape by leaving `open` as it is.
			declined(() => store.setOpen(false, details(REASONS.escapeKey, "keydown")));
			expect(store.open).toBe(true);
			onOpenChange.mockClear();

			triggerStore.leave(event("mouseleave"), leave);
			scheduler.advance(40);
			close();

			scheduler.advance(200);
			expect(onOpenChange).not.toHaveBeenCalled();
		});

		it("still reports a hover close when the pointer leaves before the rest ends", () => {
			const { store, hover, triggerStore, leave, onOpenChange, scheduler } = setupWithAppOpen({
				restMs: 100,
			});
			hover();
			scheduler.advance(40);
			triggerStore.leave(event("mouseleave"), leave);

			expect(store.open).toBe(false);
			expect(onOpenChange).toHaveBeenCalledTimes(1);
			expect(onOpenChange.mock.lastCall?.[0]).toBe(false);
			expect(onOpenChange.mock.lastCall?.[1].reason).toBe(REASONS.triggerHover);
			// And the rest it cancelled never opens.
			scheduler.advance(200);
			expect(store.open).toBe(false);
		});
	});
});
