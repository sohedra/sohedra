// Behaviour decisions the platform's wiring forwards to core: the open-event bookkeeping, trigger
// registration, the press toggle, the unmount gate, the Popup's options, pending unmounts, and the
// hover intent model with its timers. No DOM.

import { flushSync } from "svelte";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
	PATIENT_CLICK_THRESHOLD,
	type PopoverRootChangeEventReason,
	PopoverStore,
	type PopoverStoreProps,
} from "../../../src/components/popover/index.js";
import { SafePolygon } from "../../../src/foundation/hover/hover-intent.js";
import { hasMovedEnough } from "../../../src/foundation/hover/hover-rules.js";
import {
	HoverInteraction,
	HoverPopupIntent as HoverFloatingIntent,
	HoverTriggerIntent as HoverReferenceIntent,
	type HoverTriggerOptions as HoverReferenceConfig,
	type HoverView as HoverStore,
	SafePolygonSession,
} from "../../../src/foundation/hover/index.js";
import {
	bound,
	createChangeEventDetails,
	type PlatformTypes,
	REASONS,
} from "../../../src/foundation/kernel/index.js";
import { FloatingTree } from "../../../src/foundation/popup/index.js";
import { getNodeChildren } from "../../../src/foundation/popup/popup-floating-tree.js";
import { hoverOpenInstantType } from "../../../src/foundation/popup/popup-rules.js";
import { initialPosition, PositionerStore } from "../../../src/foundation/position/index.js";
import { createFakePlatform, type FakeScheduler } from "../../kit/kit-fake-platform.js";

const event = (type = "click") => ({ type }) as unknown as MouseEvent;
// Opaque stand-ins for elements: core never reads them.
const element = (name: string) => ({ name }) as unknown as HTMLElement;

/** Popover.Root's props as `$state`, the way the component exposes them, with the binding. */
type Props = PopoverStoreProps<unknown, PlatformTypes> & { open: boolean | undefined };
type MutableProps = { -readonly [K in keyof Props]: Props[K] };

const roots: (() => void)[] = [];

function setup(initial: Partial<MutableProps> = {}) {
	const props = $state<MutableProps>({
		open: undefined,
		defaultOpen: undefined,
		triggerId: undefined,
		defaultTriggerId: undefined,
		onOpenChange: undefined,
		onOpenChangeComplete: undefined,
		modal: undefined,
		...initial,
	});
	const tree = new FloatingTree();
	const platform = createFakePlatform();
	scheduler = platform.scheduler;
	const store = new PopoverStore(() => props, {
		open: bound(
			() => props.open,
			(next) => (props.open = next),
		),
		floatingId: "popup",
		tree,
		nested: false,
		platform: platform,
	});
	const cleanup = $effect.root(() => store.connect());
	roots.push(cleanup);
	flushSync();
	return { props, store, tree, cleanup };
}

const details = (reason: PopoverRootChangeEventReason, type = "click") =>
	createChangeEventDetails(reason, event(type));

// Time comes from the fake platform's scheduler, which the tests step.
let scheduler: FakeScheduler;

afterEach(() => {
	roots.splice(0).forEach((cleanup) => cleanup());
});

describe("PopupStore decisions", () => {
	it("unmounts once the close commits when unmount() is called inside onOpenChange", () => {
		const onOpenChangeComplete = vi.fn();
		const holder: { store?: PopoverStore } = {};
		const { store } = setup({
			defaultOpen: true,
			onOpenChangeComplete,
			onOpenChange: (open, eventDetails) => {
				if (!open) {
					eventDetails.preventUnmountOnClose();
					holder.store?.unmount();
				}
			},
		});
		holder.store = store;
		store.setOpen(false, details(REASONS.outsidePress));
		expect(store.open).toBe(false);
		expect(store.mounted).toBe(false);
		expect(onOpenChangeComplete).toHaveBeenCalledExactlyOnceWith(false);
	});

	it("drops an unmount() called inside a canceled close", () => {
		const holder: { store?: PopoverStore } = {};
		const { store } = setup({
			defaultOpen: true,
			onOpenChange: (open, eventDetails) => {
				if (!open) {
					holder.store?.unmount();
					eventDetails.cancel();
				}
			},
		});
		holder.store = store;
		store.setOpen(false, details(REASONS.outsidePress));
		expect(store.open).toBe(true);
		expect(store.mounted).toBe(true);
		// A later real close doesn't inherit the dropped call.
		store.setOpen(false, details(REASONS.escapeKey, "keydown"));
		expect(store.open).toBe(true);
	});

	it("keeps an unmount() requested in onOpenChange across a nested canceled change", () => {
		const onOpenChangeComplete = vi.fn();
		const holder: { store?: PopoverStore } = {};
		const { store } = setup({
			defaultOpen: true,
			onOpenChangeComplete,
			onOpenChange: (open, eventDetails) => {
				if (eventDetails.reason === REASONS.escapeKey) {
					eventDetails.cancel();
					return;
				}
				if (!open) {
					eventDetails.preventUnmountOnClose();
					holder.store?.unmount();
					// A nested change the user declines doesn't drop the outer pending unmount.
					holder.store?.setOpen(false, details(REASONS.escapeKey, "keydown"));
				}
			},
		});
		holder.store = store;
		store.setOpen(false, details(REASONS.outsidePress));
		expect(store.open).toBe(false);
		expect(store.mounted).toBe(false);
		expect(onOpenChangeComplete).toHaveBeenCalledExactlyOnceWith(false);
	});

	it("records no open event type for a change without an event", () => {
		const { store } = setup();
		const withoutEvent = (reason: PopoverRootChangeEventReason) =>
			createChangeEventDetails(reason, undefined as unknown as MouseEvent);
		store.setOpen(true, withoutEvent(REASONS.imperativeAction));
		expect(store.open).toBe(true);
		expect(store.data.openEvent).toBeUndefined();
		expect(store.data.openEventType).toBeUndefined();
		store.setOpen(false, details(REASONS.outsidePress));
		store.setOpen(true, details(REASONS.triggerPress, "click"), { eventType: "click" });
		// Not click-like, so it doesn't replace the click open event.
		store.setOpen(true, withoutEvent(REASONS.imperativeAction));
		expect(store.data.openEventType).toBe("click");
	});

	it("keeps a click-like open event over a later hover open, and forgets it on close", () => {
		const { store } = setup();
		store.setOpen(true, details(REASONS.triggerPress, "click"), { eventType: "click" });
		expect(store.data.openEventType).toBe("click");
		store.setOpen(true, details(REASONS.triggerHover, "mouseenter"), { eventType: "mouseenter" });
		expect(store.data.openEventType).toBe("click");
		store.setOpen(false, details(REASONS.outsidePress, "pointerdown"));
		expect(store.data.openEventType).toBeUndefined();
		expect(store.data.openEvent).toBeUndefined();
	});

	it("lets a click upgrade a hover open event", () => {
		const { store } = setup();
		store.setOpen(true, details(REASONS.triggerHover, "mouseenter"), { eventType: "mouseenter" });
		expect(store.data.openEventType).toBe("mouseenter");
		store.setOpen(true, details(REASONS.triggerPress, "click"), { eventType: "click" });
		expect(store.data.openEventType).toBe("click");
	});

	it("records the open event before the open-change listeners run", () => {
		const { store } = setup();
		const seen: (string | undefined)[] = [];
		store.events.on("openchange", () => seen.push(store.data.openEventType));
		store.setOpen(true, details(REASONS.triggerPress, "click"), { eventType: "click" });
		expect(seen).toEqual(["click"]);
	});

	it("decides the trigger press toggle", () => {
		const { store } = setup();
		expect(store.pressOpen(false)).toBe(true);
		store.setOpen(true, details(REASONS.triggerHover, "mouseenter"), { eventType: "mouseenter" });
		// Another trigger takes over; the owning one sticks a fresh hover open (impatient click).
		expect(store.pressOpen(false)).toBe(true);
		expect(store.pressOpen(true)).toBe(true);
		scheduler.advance(PATIENT_CLICK_THRESHOLD);
		expect(store.pressOpen(true)).toBe(false);
		store.setOpen(true, details(REASONS.triggerPress, "click"), { eventType: "click" });
		expect(store.pressOpen(true)).toBe(false);
	});

	it("registers triggers, claims an open popup without one, and keeps a replacement", () => {
		const { store } = setup({ defaultOpen: true });
		const first = element("first");
		const unregister = store.registerTrigger("t", first, {
			payload: "a",
			disabled: false,
			openOnHover: true,
			closeDelay: 20,
		});
		expect(store.activeTriggerId).toBe("t");
		expect(store.activeTriggerElement).toBe(first);
		expect(store.payload).toBe("a");
		expect(store.openOnHover).toBe(true);
		expect(store.closeDelay).toBe(20);

		const second = element("second");
		store.registerTrigger("t", second, {
			payload: "b",
			disabled: false,
			openOnHover: false,
			closeDelay: 0,
		});
		expect(store.activeTriggerElement).toBe(second);
		expect(store.payload).toBe("b");
		unregister();
		expect(store.triggers.getById("t")).toBe(second);
	});

	it("forwards trigger data only from the trigger that owns the mounted popup", () => {
		const { store } = setup();
		const trigger = element("t");
		store.registerTrigger("t", trigger, {
			payload: 1,
			disabled: false,
			openOnHover: false,
			closeDelay: 0,
		});
		const data = { payload: 2, disabled: true, openOnHover: true, closeDelay: 5 };
		store.forwardTriggerData("t", trigger, data);
		expect(store.payload).toBeUndefined();
		store.setOpen(true, createChangeEventDetails(REASONS.triggerPress, event(), trigger), {
			eventType: "click",
		});
		flushSync();
		store.forwardTriggerData("other", trigger, data);
		expect(store.payload).toBeUndefined();
		store.forwardTriggerData("t", trigger, data);
		expect(store.payload).toBe(2);
		expect(store.disabled).toBe(true);
	});

	// Svelte re-runs a derived read in an effect teardown with the values from before the flush.
	// Return focus reads the active trigger in a teardown; while the presence and the trigger's
	// reference wrote memory while deriving, that read rewound them, so the popup didn't unmount or
	// reopen.
	it("closes, unmounts and reopens when an effect teardown reads the active trigger", () => {
		const { store } = setup();
		const trigger = element("t");
		store.registerTrigger("t", trigger, {
			payload: undefined,
			disabled: false,
			openOnHover: false,
			closeDelay: 0,
		});
		const open = () =>
			store.setOpen(true, createChangeEventDetails(REASONS.triggerPress, event(), trigger), {
				eventType: "click",
			});
		open();
		flushSync();
		const seen: unknown[] = [];
		roots.push(
			$effect.root(() => {
				$effect(() => {
					void store.open;
					void store.activeTriggerElement;
					return () => {
						seen.push(store.activeTriggerElement);
					};
				});
			}),
		);
		flushSync();
		store.setOpen(false, details(REASONS.triggerPress));
		flushSync();
		expect(seen).toContain(trigger);
		expect(store.mounted).toBe(true);
		store.unmount();
		flushSync();
		expect(store.mounted).toBe(false);
		expect(store.anchorElement).toBe(trigger);
		open();
		flushSync();
		expect(store.mounted).toBe(true);
		expect(store.activeTriggerElement).toBe(trigger);
	});

	it("waits for the exit animations only while closed, mounted and not kept", () => {
		const { store } = setup({
			defaultOpen: true,
			onOpenChange: (open, eventDetails) => {
				if (!open && eventDetails.reason === REASONS.escapeKey) {
					eventDetails.preventUnmountOnClose();
				}
			},
		});
		expect(store.awaitingUnmount).toBe(false);
		store.setOpen(false, details(REASONS.outsidePress));
		expect(store.awaitingUnmount).toBe(true);
		store.unmount();
		expect(store.awaitingUnmount).toBe(false);
		store.setOpen(true, details(REASONS.triggerPress), { eventType: "click" });
		flushSync();
		store.setOpen(false, details(REASONS.escapeKey, "keydown"));
		expect(store.awaitingUnmount).toBe(false);
	});

	it("derives the Popup and Positioner options", () => {
		const { store } = setup({ modal: true });
		store.setPopupElement(element("popup"));
		expect(store.focusManagerDisabled).toBe(true);
		expect(store.defaultInitialFocus("touch")).toBe(store.popupElement);
		expect(store.defaultInitialFocus("mouse")).toBe(true);

		store.setOpen(true, details(REASONS.triggerHover, "mouseenter"), { eventType: "mouseenter" });
		flushSync();
		expect(store.focusManagerDisabled).toBe(true);
		expect(store.hasInternalBackdrop).toBe(false);

		store.setOpen(true, details(REASONS.triggerPress), { eventType: "click" });
		expect(store.focusManagerDisabled).toBe(false);
		expect(store.hasInternalBackdrop).toBe(true);

		store.applyTriggerData({
			payload: undefined,
			disabled: false,
			openOnHover: true,
			closeDelay: 0,
		});
		expect(store.hoverFloatingEnabled).toBe(true);
		store.applyTriggerData({
			payload: undefined,
			disabled: true,
			openOnHover: true,
			closeDelay: 0,
		});
		expect(store.hoverFloatingEnabled).toBe(false);

		expect(store.triggerHoverEnabled(true, false)).toBe(true);
		expect(store.triggerHoverEnabled(true, true)).toBe(false);
		store.setOpenMethod("touch");
		expect(store.triggerHoverEnabled(true, false)).toBe(false);
	});

	it("resolves the Popup's initial focus", () => {
		const { store } = setup();
		const target = element("target");
		expect(store.resolveInitialFocus(undefined)).toBe(store.defaultInitialFocus);
		expect(store.resolveInitialFocus(false)).toBe(false);
		expect(store.resolveInitialFocus(null)).toBe(null);
		expect(store.resolveInitialFocus(target)).toBe(target);
	});

	it("derives the Positioner's backdrop, scroll lock and pointer rules", () => {
		const { store } = setup({ modal: true });
		expect(store.internalBackdropMounted).toBe(false);
		expect(store.anchoredScrollLockEnabled).toBe(false);
		expect(store.positionerIgnoresPointer).toBe(true);

		store.setOpen(true, details(REASONS.triggerPress), { eventType: "click" });
		flushSync();
		expect(store.internalBackdropMounted).toBe(true);
		expect(store.anchoredScrollLockEnabled).toBe(true);
		expect(store.positionerIgnoresPointer).toBe(false);

		// Closing: still mounted until the exit animations finish.
		store.setOpen(false, details(REASONS.outsidePress));
		flushSync();
		expect(store.internalBackdropMounted).toBe(true);
		expect(store.anchoredScrollLockEnabled).toBe(false);
		expect(store.positionerIgnoresPointer).toBe(true);

		store.unmount();
		flushSync();
		expect(store.internalBackdropMounted).toBe(false);

		// A hover-opened modal popover has no internal backdrop and doesn't lock the scroll.
		store.setOpen(true, details(REASONS.triggerHover, "mouseenter"), { eventType: "mouseenter" });
		flushSync();
		expect(store.internalBackdropMounted).toBe(false);
		expect(store.anchoredScrollLockEnabled).toBe(false);
		expect(store.positionerIgnoresPointer).toBe(false);
	});

	it("records the focus guard elements through its intents", () => {
		const { store } = setup();
		const before = element("before-trigger");
		const after = element("after-trigger");
		const content = element("before-content");
		store.setBeforeTriggerGuard(before);
		store.setTriggerFocusTarget(after);
		store.setBeforeContentGuard(content);
		expect(store.beforeTriggerGuard).toBe(before);
		expect(store.triggerFocusTarget).toBe(after);
		expect(store.beforeContentGuard).toBe(content);
		store.setBeforeTriggerGuard(null);
		store.setTriggerFocusTarget(null);
		store.setBeforeContentGuard(null);
		expect(store.beforeTriggerGuard).toBe(null);
		expect(store.triggerFocusTarget).toBe(null);
		expect(store.beforeContentGuard).toBe(null);
	});

	it("adds its floating node while connected", () => {
		const { store, tree } = setup();
		const cleanup = $effect.root(() => {
			$effect(() => store.joinFloatingTree("node", null));
		});
		flushSync();
		expect(tree.nodes.map((node) => node.id)).toEqual(["node"]);
		expect(store.data.nodeId).toBe("node");
		cleanup();
		expect(tree.nodes).toEqual([]);
	});

	it("disposes hover timers when the Root's connect tears down", () => {
		const { store, cleanup } = setup();
		const callback = vi.fn();
		store.hover.openChangeTimeout.start(100, callback);
		store.hover.restTimeout.start(100, callback);
		cleanup();
		scheduler.advance(200);
		expect(callback).not.toHaveBeenCalled();
	});
});

describe("hover intent", () => {
	function config(overrides: Partial<HoverReferenceConfig> = {}): HoverReferenceConfig {
		return {
			enabled: true,
			mouseOnly: true,
			restMs: 0,
			delay: undefined,
			safePolygon: false,
			...overrides,
		};
	}

	function hoverSetup(overrides: Partial<HoverReferenceConfig> = {}) {
		const onOpenChange = vi.fn();
		const result = setup({ onOpenChange });
		const flush = vi.fn();
		const trigger = element("trigger");
		result.store.registerTrigger("t", trigger, {
			payload: undefined,
			disabled: false,
			openOnHover: true,
			closeDelay: 0,
		});
		const intent = new HoverReferenceIntent(
			() => result.store as unknown as HoverStore,
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

	it("opens after the open delay, and flushes the commit", () => {
		const { store, intent, target, flush } = hoverSetup({ delay: { open: 100 } });
		intent.enter(event("mouseenter"), target);
		expect(store.open).toBe(false);
		scheduler.advance(100);
		expect(store.open).toBe(true);
		expect(store.openChangeReason).toBe(REASONS.triggerHover);
		expect(flush).toHaveBeenCalled();
	});

	it("opens only after the pointer rests with a rest-only delay", () => {
		const { store, intent, target } = hoverSetup({ restMs: 50 });
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

	it("restarts a pending rest only for a move of at least √2px", () => {
		expect(hasMovedEnough(0, 0)).toBe(false);
		expect(hasMovedEnough(1, 0)).toBe(false);
		expect(hasMovedEnough(0, -1)).toBe(false);
		expect(hasMovedEnough(1, 1)).toBe(true);
		expect(hasMovedEnough(-1, -1)).toBe(true);
		expect(hasMovedEnough(0, 2)).toBe(true);
	});

	it("doesn't let a pending rest open override a click open made meanwhile", () => {
		const { store, intent, target, onOpenChange } = hoverSetup({ restMs: 50 });
		intent.enter(event("mouseenter"), target);
		intent.move(event("mousemove"), target, 2, 0);
		store.setOpen(true, details(REASONS.triggerPress, "click"), { eventType: "click" });
		scheduler.advance(50);
		expect(onOpenChange).toHaveBeenCalledTimes(1);
		expect(store.data.openEventType).toBe("click");
	});

	it("ignores non-mouse pointers when mouse-only", () => {
		const { store, intent, target } = hoverSetup();
		intent.pointerType("touch");
		intent.enter(event("mouseenter"), target);
		expect(store.open).toBe(false);
	});

	it("closes after the close delay when leaving, and the delay dies with the hover state", () => {
		const { store, intent, target, leave } = hoverSetup({ delay: { close: 100 } });
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
		const { store, intent, target, leave } = hoverSetup({ mouseOnly: false });
		intent.pointerType("touch");
		intent.enter(event("mouseenter"), target);
		expect(store.open).toBe(true);
		intent.leave(event("mouseleave"), { ...leave, intoFloating: true });
		expect(store.open).toBe(true);
		intent.leave(event("mouseleave"), leave);
		expect(store.open).toBe(false);
	});

	it("doesn't close a click-opened popup on leave", () => {
		const { store, intent, leave } = hoverSetup();
		store.setOpen(true, details(REASONS.triggerPress, "click"), { eventType: "click" });
		intent.leave(event("mouseleave"), leave);
		expect(store.open).toBe(true);
	});

	it("reopens at once when re-entering during a hover close", () => {
		const { store, intent, target, leave } = hoverSetup({ restMs: 50 });
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
		const { store, target, leave } = hoverSetup();
		const intent = new HoverReferenceIntent(
			() => store as unknown as HoverStore,
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

	it("closes a hover-opened popup when the pointer leaves it, but not a click-opened one", () => {
		const { store } = hoverSetup();
		const floating = new HoverFloatingIntent(
			store as unknown as HoverStore,
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
		const { store } = hoverSetup();
		const floating = new HoverFloatingIntent(
			store as unknown as HoverStore,
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

	it("forgets the pointer and the inside press once closed", () => {
		const { store } = setup({ defaultOpen: true });
		store.hover.pointerType = "touch";
		store.hover.interactedInside = true;
		store.setOpen(false, details(REASONS.outsidePress));
		flushSync();
		expect(store.hover.pointerType).toBeUndefined();
		expect(store.hover.interactedInside).toBe(false);
	});
});

describe("SafePolygonSession", () => {
	// Trigger at 100,100 (100×20); popup below it at 50,130 (200×100), a 10px gap.
	const box = (left: number, top: number, width: number, height: number) => ({
		left,
		top,
		width,
		height,
		right: left + width,
		bottom: top + height,
	});
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
		const { store } = setup();
		const onClose = vi.fn();
		const session = new SafePolygonSession(new SafePolygon("bottom", 150, 121, 0), store, onClose);
		session.move(towardsPopup);
		scheduler.advance(39);
		expect(onClose).not.toHaveBeenCalled();
		scheduler.advance(1);
		expect(onClose).toHaveBeenCalledOnce();
	});

	it("drops a pending close-soon on a move it can't measure", () => {
		const { store } = setup();
		const onClose = vi.fn();
		const session = new SafePolygonSession(new SafePolygon("bottom", 150, 121, 0), store, onClose);
		session.move(towardsPopup);
		// The trigger or popup is gone: the handler clears its timer before bailing out.
		session.move(null);
		scheduler.advance(100);
		expect(onClose).not.toHaveBeenCalled();
	});

	it("drops a pending close-soon when the hover state clears its tracker", () => {
		const { store } = setup();
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
		const { store, tree } = setup();
		store.data.nodeId = "parent";
		tree.addNode({ id: "child", parentId: "parent", context: { ...store, open: true } as never });
		expect(getNodeChildren(tree.nodes, "parent")).toHaveLength(1);
		const onClose = vi.fn();
		const session = new SafePolygonSession(new SafePolygon("bottom", 150, 121, 0), store, onClose);
		session.move({ ...towardsPopup, clientY: 50 });
		scheduler.advance(100);
		expect(onClose).not.toHaveBeenCalled();
	});

	it("starts without a tracker", () => {
		expect(new HoverInteraction(createFakePlatform().scheduler).handler).toBeUndefined();
	});
});

describe("hoverOpenInstantType", () => {
	it("skips transitions for a focus opening and a press or Escape close", () => {
		expect(hoverOpenInstantType(true, REASONS.triggerFocus, undefined)).toBe("focus");
		expect(hoverOpenInstantType(false, REASONS.triggerPress, undefined)).toBe("dismiss");
		expect(hoverOpenInstantType(false, REASONS.escapeKey, "focus")).toBe("dismiss");
	});

	it("clears it for a hover change and keeps it for any other change", () => {
		expect(hoverOpenInstantType(true, REASONS.triggerHover, "focus")).toBe(undefined);
		expect(hoverOpenInstantType(false, REASONS.triggerHover, "dismiss")).toBe(undefined);
		expect(hoverOpenInstantType(false, REASONS.triggerFocus, "focus")).toBe("focus");
		expect(hoverOpenInstantType(true, REASONS.triggerPress, "dismiss")).toBe("dismiss");
		expect(hoverOpenInstantType(false, REASONS.outsidePress, "focus")).toBe("focus");
	});
});
