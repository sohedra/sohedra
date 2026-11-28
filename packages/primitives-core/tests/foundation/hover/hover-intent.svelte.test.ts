// The hover intent: HoverInteraction's timers and close tracker, a trigger's hover opening and
// closing a popup with its delays, rest and safe polygon, the popup's own hover, a safe-polygon
// session, and hovering after the app closed the popup itself: a bound `open` set to false from
// outside passes no request, so nothing clears the recorded open event (a reopen from outside still
// needs it) and no open-change event reaches the triggers.
import { flushSync } from "svelte";
import { describe, expect, it, vi } from "vitest";

import { PATIENT_CLICK_THRESHOLD } from "../../../src/components/popover/index.js";
import { SafePolygon } from "../../../src/foundation/hover/hover-intent.js";
import {
	HoverInteraction,
	HoverPopupIntent,
	HoverTriggerIntent,
	type HoverTriggerOptions,
	type HoverView,
	SafePolygonSession,
} from "../../../src/foundation/hover/index.js";
import { REASONS } from "../../../src/foundation/kernel/index.js";
import { initialPosition, PositionerStore } from "../../../src/foundation/position/index.js";
import { changeDetails as details } from "../../kit/kit-details.js";
import { createFakePlatform } from "../../kit/kit-fake-platform.js";
import { box } from "../../kit/kit-geometry.js";
import { createPopover } from "../../kit/kit-popover.svelte.js";
import { element, event } from "../../kit/kit-stand-ins.js";

function config(overrides: Partial<HoverTriggerOptions> = {}): HoverTriggerOptions {
	return {
		enabled: true,
		mouseOnly: true,
		restMs: 0,
		delay: undefined,
		safePolygon: false,
		...overrides,
	};
}

/**
 * A Popover store with one hover trigger, `t`, and that trigger's intent with `overrides` on the
 * default options; `flush` is a spy. The trigger doesn't follow the popup's open changes unless a
 * test wires it.
 */
function setup(overrides: Partial<HoverTriggerOptions> = {}) {
	const onOpenChange = vi.fn();
	const result = createPopover({ onOpenChange });
	const flush = vi.fn();
	const trigger = element("trigger");
	result.store.registerTrigger("t", trigger, {
		payload: undefined,
		disabled: false,
		openOnHover: true,
		closeDelay: 0,
	});
	const intent = new HoverTriggerIntent(
		() => result.store as unknown as HoverView,
		() => config(overrides),
		flush,
	);
	const target = {
		trigger,
		eventType: "mouseenter" as const,
		overInactiveTrigger: false,
		withinReference: true,
	};
	const leave = {
		trigger,
		intoEnabledTrigger: false,
		intoFloating: false,
		clientX: 0,
		clientY: 0,
	};
	return { ...result, onOpenChange, flush, trigger, intent, target, leave };
}

/**
 * A Popover store whose `open` the test owns, one hover trigger that follows the popup's open
 * changes, and its intent (rest 50ms unless `overrides` say otherwise). `close()` and `reopen()`
 * change `open` from outside, the way an app's own code does.
 */
function setupWithAppOpen(overrides: Partial<HoverTriggerOptions> = {}) {
	const onOpenChange = vi.fn();
	// While true the app leaves `open` as it is, whatever the popup asks for.
	let declining = false;
	const { props, store, scheduler } = createPopover(
		{ open: false, onOpenChange },
		{ accepts: () => !declining },
	);

	const trigger = element("trigger");
	store.registerTrigger("t", trigger, {
		payload: undefined,
		disabled: false,
		openOnHover: true,
		closeDelay: 0,
	});
	const view = store as unknown as HoverView;
	const intent = new HoverTriggerIntent(
		() => view,
		() => config({ restMs: 50, ...overrides }),
		flushSync,
	);
	// The trigger follows the popup's open changes, as the platform wires it.
	store.events.on("openchange", (change) => intent.openChanged(change));

	const target = {
		trigger,
		eventType: "mousemove" as const,
		overInactiveTrigger: false,
		withinReference: true,
	};
	const leave = {
		trigger,
		intoEnabledTrigger: false,
		intoFloating: false,
		clientX: 0,
		clientY: 0,
	};
	return {
		store,
		view,
		intent,
		target,
		leave,
		onOpenChange,
		scheduler,
		/** The pointer comes onto the trigger and rests there. */
		hover() {
			intent.enter(event("mouseenter"), target);
			intent.move(event("mousemove"), target, 2, 0);
		},
		press() {
			store.setOpen(true, details(REASONS.triggerPress, "click"), { eventType: "click" });
			flushSync();
		},
		close() {
			props.open = false;
			flushSync();
		},
		reopen() {
			props.open = true;
			flushSync();
		},
		/** Sets the bound `open` without letting effects run yet. */
		writeOpen(next: boolean) {
			props.open = next;
		},
		/** Runs `change` while the app ignores what the popup asks for, without cancelling it. */
		declined(change: () => void) {
			declining = true;
			change();
			declining = false;
			flushSync();
		},
	};
}

describe("HoverInteraction", () => {
	describe("cancelPendingOpen", () => {
		it("drops a pending delayed open and a pending rest open in one call", () => {
			const { scheduler } = createFakePlatform();
			const hover = new HoverInteraction(scheduler);
			const callback = vi.fn();
			hover.openChangeTimeout.start(100, callback);
			hover.restTimeout.start(100, callback);
			hover.restTimeoutPending = true;
			hover.cancelPendingOpen();
			scheduler.advance(200);
			expect(callback).not.toHaveBeenCalled();
			expect(hover.restTimeoutPending).toBe(false);
		});
	});

	describe("cancelPending", () => {
		it("drops a delayed change, a rest open and the safe polygon", () => {
			const { scheduler: time } = createFakePlatform();
			const hover = new HoverInteraction(time);
			const callback = vi.fn();
			const dispose = vi.fn();
			hover.openChangeTimeout.start(100, callback);
			hover.restTimeout.start(100, callback);
			hover.restTimeoutPending = true;
			hover.setCloseTracker({ handler: () => {}, dispose });

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
			const hover = new HoverInteraction(time);
			const callback = vi.fn();
			const dispose = vi.fn();
			hover.blockMouseMove = false;
			hover.openChangeTimeout.start(100, callback);
			hover.restTimeout.start(100, callback);
			hover.restTimeoutPending = true;
			hover.setCloseTracker({ handler: () => {}, dispose });

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
		expect(new HoverInteraction(createFakePlatform().scheduler).handler).toBeUndefined();
	});

	it("forgets the pointer and the inside press once closed", () => {
		const { store } = createPopover({ defaultOpen: true });
		store.hover.pointerType = "touch";
		store.hover.interactedInside = true;
		store.setOpen(false, details(REASONS.outsidePress));
		flushSync();
		expect(store.hover.pointerType).toBeUndefined();
		expect(store.hover.interactedInside).toBe(false);
	});
});

describe("HoverTriggerIntent", () => {
	it("opens after the open delay, and flushes the commit", () => {
		const { store, intent, target, flush, scheduler } = setup({ delay: { open: 100 } });
		intent.enter(event("mouseenter"), target);
		expect(store.open).toBe(false);
		scheduler.advance(100);
		expect(store.open).toBe(true);
		expect(store.openChangeReason).toBe(REASONS.triggerHover);
		expect(flush).toHaveBeenCalled();
	});

	it("opens only after the pointer rests with a rest-only delay", () => {
		const { store, intent, target, scheduler } = setup({ restMs: 50 });
		intent.enter(event("mouseenter"), target);
		scheduler.advance(100);
		expect(store.open).toBe(false);
		intent.move(event("mousemove"), target, 2, 0);
		scheduler.advance(49);
		expect(store.open).toBe(false);
		// Small moves don't restart a pending rest.
		intent.move(event("mousemove"), target, 1, 0);
		scheduler.advance(1);
		expect(store.open).toBe(true);
	});

	it("doesn't let a pending rest open override a click open made meanwhile", () => {
		const { store, intent, target, onOpenChange, scheduler } = setup({ restMs: 50 });
		intent.enter(event("mouseenter"), target);
		intent.move(event("mousemove"), target, 2, 0);
		store.setOpen(true, details(REASONS.triggerPress, "click"), { eventType: "click" });
		scheduler.advance(50);
		expect(onOpenChange).toHaveBeenCalledTimes(1);
		expect(store.openEventType).toBe("click");
	});

	it("ignores non-mouse pointers when mouse-only", () => {
		const { store, intent, target } = setup();
		intent.pointerType("touch");
		intent.enter(event("mouseenter"), target);
		expect(store.open).toBe(false);
	});

	it("closes after the close delay when leaving, and the delay dies with the hover state", () => {
		const { store, intent, target, leave, scheduler } = setup({ delay: { close: 100 } });
		intent.enter(event("mouseenter"), target);
		expect(store.open).toBe(true);
		intent.leave(event("mouseleave"), leave);
		scheduler.advance(99);
		expect(store.open).toBe(true);
		scheduler.advance(1);
		expect(store.open).toBe(false);

		intent.enter(event("mouseenter"), target);
		intent.leave(event("mouseleave"), leave);
		store.hover.dispose();
		scheduler.advance(200);
		expect(store.open).toBe(true);
	});

	it("keeps a touch-hovered popup open when the pointer moves into it", () => {
		const { store, intent, target, leave } = setup({ mouseOnly: false });
		intent.pointerType("touch");
		intent.enter(event("mouseenter"), target);
		expect(store.open).toBe(true);
		intent.leave(event("mouseleave"), { ...leave, intoFloating: true });
		expect(store.open).toBe(true);
		intent.leave(event("mouseleave"), leave);
		expect(store.open).toBe(false);
	});

	it("doesn't close a click-opened popup on leave", () => {
		const { store, intent, leave } = setup();
		store.setOpen(true, details(REASONS.triggerPress, "click"), { eventType: "click" });
		intent.leave(event("mouseleave"), leave);
		expect(store.open).toBe(true);
	});

	it("reopens at once when re-entering during a hover close", () => {
		const { store, intent, target, leave } = setup({ restMs: 50 });
		store.setOpen(true, details(REASONS.triggerHover, "mouseenter"), { eventType: "mouseenter" });
		flushSync();
		store.events.on("openchange", (d) => intent.openChanged(d));
		intent.leave(event("mouseleave"), leave);
		flushSync();
		expect(store.open).toBe(false);
		expect(store.transitionStatus).toBe("ending");
		intent.enter(event("mouseenter"), target);
		expect(store.open).toBe(true);
	});

	it("starts a safe polygon on leave once the Positioner reports a side", () => {
		const { store, target, leave } = setup();
		const intent = new HoverTriggerIntent(
			() => store as unknown as HoverView,
			() => config({ safePolygon: true }),
			() => {},
		);
		intent.enter(event("mouseenter"), target);
		expect(intent.leave(event("mouseleave"), leave)).toBeUndefined();
		expect(store.open).toBe(false);

		intent.enter(event("mouseenter"), target);
		store.positionerClaim.claim(
			{},
			new PositionerStore({
				initial: initialPosition({ side: "bottom", align: "center", rtl: false }),
			}),
		);
		expect(intent.leave(event("mouseleave"), leave)).toBeInstanceOf(SafePolygonSession);
		expect(store.open).toBe(true);
	});
});

describe("HoverPopupIntent", () => {
	it("closes a hover-opened popup when the pointer leaves it, but not a click-opened one", () => {
		const { store, scheduler } = setup();
		const floating = new HoverPopupIntent(
			store as unknown as HoverView,
			() => ({ enabled: true, closeDelay: 30 }),
			() => {},
		);
		const into = { enabledTrigger: false, descendant: false };
		store.setOpen(true, details(REASONS.triggerHover, "mouseenter"), { eventType: "mouseenter" });
		floating.leave(event("mouseleave"), into);
		scheduler.advance(30);
		expect(store.open).toBe(false);

		store.setOpen(true, details(REASONS.triggerPress, "click"), { eventType: "click" });
		floating.leave(event("mouseleave"), into);
		scheduler.advance(30);
		expect(store.open).toBe(true);
	});

	it("treats a press on a popup-opening element inside as click-like", () => {
		const { store } = setup();
		const floating = new HoverPopupIntent(
			store as unknown as HoverView,
			() => ({ enabled: true, closeDelay: 0 }),
			() => {},
		);
		store.setOpen(true, details(REASONS.triggerHover, "mouseenter"), { eventType: "mouseenter" });
		floating.pressInside(true, true);
		floating.leave(event("mouseleave"), { enabledTrigger: false, descendant: false });
		expect(store.open).toBe(true);
		floating.pressInside(true, false);
		floating.leave(event("mouseleave"), { enabledTrigger: false, descendant: false });
		expect(store.open).toBe(false);
	});
});

describe("SafePolygonSession", () => {
	// Trigger at 100,100 (100×20); popup below it at 50,130 (200×100), a 10px gap.
	// Inside the triangle towards the popup, not landed yet: a close-soon.
	const towardsPopup = {
		clientX: 95,
		clientY: 128,
		isLeave: false,
		isOverFloating: false,
		isOverReference: false,
		leavingIntoFloating: false,
		measure: () => ({ reference: box(100, 100, 100, 20), floating: box(50, 130, 200, 100) }),
	};

	it("closes 40ms after a close-soon move unless another move arrives", () => {
		const { store, scheduler } = createPopover();
		const onClose = vi.fn();
		const session = new SafePolygonSession(new SafePolygon("bottom", 150, 121, 0), store, onClose);
		session.move(towardsPopup);
		scheduler.advance(39);
		expect(onClose).not.toHaveBeenCalled();
		scheduler.advance(1);
		expect(onClose).toHaveBeenCalledOnce();
	});

	it("drops a pending close-soon on a move it can't measure", () => {
		const { store, scheduler } = createPopover();
		const onClose = vi.fn();
		const session = new SafePolygonSession(new SafePolygon("bottom", 150, 121, 0), store, onClose);
		session.move(towardsPopup);
		// The trigger or popup is gone: the handler clears its timer before bailing out.
		session.move(null);
		scheduler.advance(100);
		expect(onClose).not.toHaveBeenCalled();
	});

	it("drops a pending close-soon when the hover state clears its tracker", () => {
		const { store, scheduler } = createPopover();
		const onClose = vi.fn();
		const removeListener = vi.fn();
		const session = new SafePolygonSession(new SafePolygon("bottom", 150, 121, 0), store, onClose);
		store.hover.setCloseTracker({
			handler: () => {},
			dispose() {
				removeListener();
				session.dispose();
			},
		});
		session.move(towardsPopup);
		store.hover.clearCloseTracker();
		scheduler.advance(100);
		expect(removeListener).toHaveBeenCalledOnce();
		expect(onClose).not.toHaveBeenCalled();
		expect(store.hover.handler).toBeUndefined();
	});

	it("stays open while a nested popup is open", () => {
		const { store, tree, scheduler } = createPopover();
		store.joinFloatingTree("parent", null);
		tree.addNode({
			id: "child",
			parentId: "parent",
			context: {
				open: true,
				floatingElement: null,
				anchorElement: null,
				dismissBubbles: { escapeKey: false, outsidePress: true },
			},
		});
		expect(tree.children("parent")).toHaveLength(1);
		const onClose = vi.fn();
		const session = new SafePolygonSession(new SafePolygon("bottom", 150, 121, 0), store, onClose);
		session.move({ ...towardsPopup, clientY: 50 });
		scheduler.advance(100);
		expect(onClose).not.toHaveBeenCalled();
	});
});

describe("a close from outside", () => {
	describe("hovering again", () => {
		it("opens again on hover after a click-opened popup was closed from outside", () => {
			const { store, hover, press, close, leave, intent, scheduler } = setupWithAppOpen();
			press();
			expect(store.open).toBe(true);
			// Pinned by the click: leaving the trigger doesn't close it.
			intent.leave(event("mouseleave"), leave);
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
			const { store, hover, press, close, intent, leave, scheduler } = setupWithAppOpen();
			press();
			close();
			hover();
			scheduler.advance(50);
			expect(store.open).toBe(true);
			intent.leave(event("mouseleave"), leave);
			expect(store.open).toBe(false);
		});

		it("keeps a click-opened popup pinned once it is reopened from outside", () => {
			const { store, press, close, reopen, intent, target, leave, scheduler } = setupWithAppOpen();
			press();
			close();
			reopen();
			expect(store.open).toBe(true);
			expect(store.openEventType).toBe("click");

			// Open again and still held by its click: hovering in and out changes nothing.
			intent.enter(event("mouseenter"), target);
			intent.leave(event("mouseleave"), leave);
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
			const popup = new HoverPopupIntent(view, () => ({ enabled: true, closeDelay: 0 }), flushSync);
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
			const { store, hover, close, intent, target, leave, onOpenChange, scheduler } =
				setupWithAppOpen();
			hover();
			scheduler.advance(50);
			expect(store.open).toBe(true);

			close();
			onOpenChange.mockClear();
			// The pointer never left: moves alone must not reopen it, however often they come.
			intent.move(event("mousemove"), target, 2, 0);
			scheduler.advance(50);
			intent.move(event("mousemove"), target, 20, 0);
			scheduler.advance(50);
			expect(store.open).toBe(false);
			expect(onOpenChange).not.toHaveBeenCalled();

			intent.leave(event("mouseleave"), leave);
			hover();
			scheduler.advance(50);
			expect(store.open).toBe(true);
			expect(store.openChangeReason).toBe(REASONS.triggerHover);
		});

		it("keeps a click-opened popup closed until the pointer leaves and enters again", () => {
			const { store, hover, press, close, intent, target, leave, onOpenChange, scheduler } =
				setupWithAppOpen();
			// The pointer is on the trigger when it is pressed.
			intent.enter(event("mouseenter"), target);
			press();
			expect(store.open).toBe(true);

			close();
			onOpenChange.mockClear();
			intent.move(event("mousemove"), target, 2, 0);
			scheduler.advance(50);
			intent.move(event("mousemove"), target, 20, 0);
			scheduler.advance(50);
			expect(store.open).toBe(false);
			expect(onOpenChange).not.toHaveBeenCalled();

			intent.leave(event("mouseleave"), leave);
			hover();
			scheduler.advance(50);
			expect(store.open).toBe(true);
			expect(store.openChangeReason).toBe(REASONS.triggerHover);
		});
	});

	describe("after a requested close the app undid in the same update", () => {
		it("doesn't let that close stand in for a later close from outside", () => {
			const { store, hover, close, writeOpen, intent, leave, onOpenChange, scheduler } =
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

			intent.leave(event("mouseleave"), leave);
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
			const { store, intent, target, close, reopen, onOpenChange, scheduler } = setupWithAppOpen({
				restMs: 0,
				delay: { open: 100 },
			});
			intent.enter(event("mouseenter"), target);
			scheduler.advance(40);
			reopen();
			close();

			scheduler.advance(200);
			expect(store.open).toBe(false);
			expect(onOpenChange).not.toHaveBeenCalled();
		});

		it("drops a delayed hover close, so no close is reported for a popup already closed", () => {
			const { store, hover, close, intent, leave, onOpenChange, scheduler } = setupWithAppOpen({
				delay: { close: 100 },
			});
			hover();
			scheduler.advance(50);
			expect(store.open).toBe(true);
			onOpenChange.mockClear();

			intent.leave(event("mouseleave"), leave);
			scheduler.advance(40);
			close();

			scheduler.advance(200);
			expect(onOpenChange).not.toHaveBeenCalled();
		});

		it("drops the safe polygon, so a later pointer move reports no close", () => {
			const { store, hover, close, intent, leave, onOpenChange, scheduler } = setupWithAppOpen({
				safePolygon: true,
			});
			store.positionerClaim.claim(
				{},
				new PositionerStore({
					initial: initialPosition({ side: "bottom", align: "center", rtl: false }),
				}),
			);
			hover();
			scheduler.advance(50);
			expect(store.open).toBe(true);
			onOpenChange.mockClear();

			const session = intent.leave(event("mouseleave"), leave);
			expect(session).toBeInstanceOf(SafePolygonSession);
			const dispose = vi.fn();
			store.hover.setCloseTracker({ handler: () => {}, dispose });

			close();
			expect(dispose).toHaveBeenCalledTimes(1);
			expect(store.hover.handler).toBeUndefined();
			expect(onOpenChange).not.toHaveBeenCalled();
		});

		it("reports no hover close when the pointer leaves the popup after a close from outside", () => {
			const { store, view, hover, close, onOpenChange, scheduler } = setupWithAppOpen();
			const popup = new HoverPopupIntent(
				view,
				() => ({ enabled: true, closeDelay: 30 }),
				flushSync,
			);
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
			const { store, hover, close, declined, intent, leave, onOpenChange, scheduler } =
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

			intent.leave(event("mouseleave"), leave);
			scheduler.advance(40);
			close();

			scheduler.advance(200);
			expect(onOpenChange).not.toHaveBeenCalled();
		});

		it("still reports a hover close when the pointer leaves before the rest ends", () => {
			const { store, hover, intent, leave, onOpenChange, scheduler } = setupWithAppOpen({
				restMs: 100,
			});
			hover();
			scheduler.advance(40);
			intent.leave(event("mouseleave"), leave);

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
