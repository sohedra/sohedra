// PopupStore, through the Popover store and a kind without hover: unmounting from onOpenChange,
// the open event it records, the press toggle, trigger registration and forwarded data, the exit
// gate, the Popup's and Positioner's options, focus guards, its floating node, its hover state and
// timers, and the outside press of its behaviour row.
import { flushSync } from "svelte";
import { describe, expect, it, vi } from "vitest";

import {
	PATIENT_CLICK_THRESHOLD,
	type PopoverRootChangeEventReason,
	type PopoverStore,
} from "../../../src/components/popover/index.js";
import { HoverInteraction } from "../../../src/foundation/hover/index.js";
import { bound, createChangeEventDetails, REASONS } from "../../../src/foundation/kernel/index.js";
import {
	FloatingTree,
	type PopupBehavior,
	PopupStore,
} from "../../../src/foundation/popup/index.js";
import { changeDetails as details } from "../../kit/kit-details.js";
import { root } from "../../kit/kit-effects.svelte.js";
import { createFakePlatform } from "../../kit/kit-fake-platform.js";
import { createPopover, type PopoverProps } from "../../kit/kit-popover.svelte.js";
import { element, event } from "../../kit/kit-stand-ins.js";

/** The Popover store, connected; time comes from `scheduler`, which tests step. */
function setup(initial: Partial<PopoverProps> = {}) {
	return createPopover(initial);
}

/** A plain kind's props as `$state`, with `open` for the binding. */
function createProps() {
	const props = $state<PopoverProps>({
		open: undefined,
		defaultOpen: undefined,
		triggerId: undefined,
		defaultTriggerId: undefined,
		onOpenChange: undefined,
		onOpenChangeComplete: undefined,
		modal: undefined,
	});
	return props;
}

describe("PopupStore", () => {
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
		const { store, scheduler } = setup();
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
		root(() => {
			$effect(() => {
				void store.open;
				void store.activeTriggerElement;
				return () => {
					seen.push(store.activeTriggerElement);
				};
			});
		});
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
		store.guards.setBeforeTrigger(before);
		store.guards.setAfterTrigger(after);
		store.guards.setBeforeContent(content);
		expect(store.guards.beforeTrigger).toBe(before);
		expect(store.guards.afterTrigger).toBe(after);
		expect(store.guards.beforeContent).toBe(content);
		store.guards.setBeforeTrigger(null);
		store.guards.setAfterTrigger(null);
		store.guards.setBeforeContent(null);
		expect(store.guards.beforeTrigger).toBe(null);
		expect(store.guards.afterTrigger).toBe(null);
		expect(store.guards.beforeContent).toBe(null);
	});

	it("adds its floating node while connected", () => {
		const { store, tree } = setup();
		const cleanup = root(() => {
			$effect(() => store.joinFloatingTree("node", null));
		});
		flushSync();
		expect(tree.nodes.map((node) => node.id)).toEqual(["node"]);
		expect(store.data.nodeId).toBe("node");
		cleanup();
		expect(tree.nodes).toEqual([]);
	});

	it("disposes hover timers when the Root's connect tears down", () => {
		const { store, disconnect, scheduler } = setup();
		const callback = vi.fn();
		store.hover.openChangeTimeout.start(100, callback);
		store.hover.restTimeout.start(100, callback);
		disconnect();
		scheduler.advance(200);
		expect(callback).not.toHaveBeenCalled();
	});

	const plain: PopupBehavior = { outsidePress: "sloppy", side: "bottom" };

	/** A kind whose behaviour row has no `hover`. */
	class PlainStore extends PopupStore {
		protected readonly hooks = {};

		constructor(props: PopoverProps) {
			super(() => props, {
				open: bound(
					() => props.open,
					(next) => (props.open = next),
				),
				floatingId: "popup",
				tree: new FloatingTree(),
				nested: false,
				platform: createFakePlatform(),
				kind: { name: "Plain", behavior: plain },
			});
		}
	}

	it("builds hover state only for a kind whose behaviour row has hover", () => {
		const store = new PlainStore(createProps());
		root(() => store.connect());
		flushSync();
		expect(store.hover).toBe(null);

		// Trigger data and a full open and close run without it.
		store.applyTriggerData({ payload: 1 });
		store.setOpen(true, details(REASONS.triggerPress));
		flushSync();
		store.setOpen(false, details(REASONS.outsidePress));
		flushSync();
		expect(store.payload).toBe(1);
		expect(store.open).toBe(false);

		expect(createPopover({}, { connect: false }).store.hover).toBeInstanceOf(HoverInteraction);
	});

	it("dismisses a focus-trapping popover on the press itself, for a mouse too", () => {
		const { props, store } = createPopover({}, { connect: false });
		expect(store.outsidePressEvent).toEqual({ mouse: "intentional", touch: "sloppy" });
		props.modal = true;
		expect(store.outsidePressEvent).toEqual({ mouse: "intentional", touch: "sloppy" });
		props.modal = "trap-focus";
		expect(store.outsidePressEvent).toEqual({ mouse: "sloppy", touch: "sloppy" });
	});
});
