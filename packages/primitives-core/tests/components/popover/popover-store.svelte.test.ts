// PopoverStore: an open change with its callback, cancel and reasons, the active trigger, the
// instant type, unmounting, a trigger press and a close, its parts' state, the trigger focus
// guards, a change it reports, and the handle that drives it imperatively.
import { flushSync } from "svelte";
import { describe, expect, it, onTestFinished, vi } from "vitest";

import {
	createPopoverHandle,
	PATIENT_CLICK_THRESHOLD,
	popoverArrowState,
	popoverPopupState,
	type PopoverRootChangeEventDetails,
	type PopoverStore,
} from "../../../src/components/popover/index.js";
import {
	createChangeEventDetails,
	type PlatformTypes,
	REASONS,
} from "../../../src/foundation/kernel/index.js";
import { initialPosition, PositionerStore } from "../../../src/foundation/position/index.js";
import { createPopover, type PopoverProps } from "../../kit/kit-popover.svelte.js";
import { element, event } from "../../kit/kit-stand-ins.js";

/** The store as Popover.Root builds it, connected; time comes from `scheduler`, which tests step. */
function setup(initial: Partial<PopoverProps> = {}) {
	return createPopover(initial);
}

const press = (trigger?: Element) =>
	createChangeEventDetails(REASONS.triggerPress, event() as MouseEvent, trigger);

/** A trigger registered with the store, as Popover.Trigger registers it. */
function register(store: PopoverStore, id: string) {
	const trigger = element(id);
	onTestFinished(
		store.registerTrigger(id, trigger, {
			payload: undefined,
			disabled: false,
			openOnHover: false,
			closeDelay: 0,
		}),
	);
	flushSync();
	return trigger;
}

/** A press on `trigger`, by a pointer or (`keyboard`) by Enter or Space. */
function pressTrigger(store: PopoverStore, trigger: Element, keyboard = false) {
	const accepted = store.pressTrigger(
		trigger,
		createChangeEventDetails(
			REASONS.triggerPress,
			event("click", { detail: keyboard ? 0 : 1 }) as MouseEvent,
			trigger,
		),
		{ keyboardClick: keyboard, eventType: "click" },
	);
	flushSync();
	return accepted;
}

describe("PopoverStore", () => {
	it("calls onOpenChange first, then commits open, the reason and the active trigger", () => {
		const onOpenChange = vi.fn();
		const { props, store } = setup({ onOpenChange });
		const trigger = element("t");
		store.triggers.add("t", trigger);
		store.setOpen(true, press(trigger), { eventType: "click" });
		expect(onOpenChange).toHaveBeenCalledWith(
			true,
			expect.objectContaining({ reason: "trigger-press" }),
		);
		expect(store.open).toBe(true);
		expect(props.open).toBe(true);
		expect(store.activeTriggerId).toBe("t");
		expect(store.activeTriggerElement).toBe(trigger);
		expect(store.openChangeReason).toBe("trigger-press");
		expect(store.activeTrigger.isOpenedBy("t")).toBe(true);
		expect(store.triggerPopupId("t")).toBe("popup");
	});

	it("keeps the popup closed when onOpenChange cancels", () => {
		const { store } = setup({
			onOpenChange: (_open, details) => details.cancel(),
		});
		store.setOpen(true, press(), { eventType: "click" });
		expect(store.open).toBe(false);
		expect(store.mounted).toBe(false);
	});

	it("emits the open-change event before committing", () => {
		const { store } = setup();
		const seen: boolean[] = [];
		store.events.on("openchange", () => seen.push(store.open));
		store.setOpen(true, press(), { eventType: "click" });
		expect(seen).toEqual([false]);
	});

	it("keeps the trigger of a closing popup, so focus can return to it", () => {
		const { store } = setup();
		const trigger = element("t");
		store.triggers.add("t", trigger);
		store.setOpen(true, press(trigger), { eventType: "click" });
		// Mounted once the open state renders (an open and close in one flush never mounts).
		flushSync();
		store.setOpen(
			false,
			createChangeEventDetails(REASONS.escapeKey, event("keydown") as KeyboardEvent),
		);
		expect(store.activeTriggerId).toBe("t");
		expect(store.activeTriggerElement).toBe(trigger);
		expect(store.instantType).toBe("dismiss");
	});

	it("stays mounted after a close with preventUnmountOnClose() until unmount()", () => {
		const onOpenChangeComplete = vi.fn();
		const { store } = setup({
			defaultOpen: true,
			onOpenChangeComplete,
			onOpenChange: (open, details) => {
				if (!open) {
					details.preventUnmountOnClose();
				}
			},
		});
		store.setOpen(false, createChangeEventDetails(REASONS.outsidePress, event() as MouseEvent));
		expect(store.open).toBe(false);
		expect(store.mounted).toBe(true);
		expect(store.preventUnmountingOnClose).toBe(true);
		store.unmount();
		expect(store.mounted).toBe(false);
		expect(store.preventUnmountingOnClose).toBe(false);
		expect(onOpenChangeComplete).toHaveBeenCalledExactlyOnceWith(false);
		store.unmount();
		expect(onOpenChangeComplete).toHaveBeenCalledTimes(1);
	});

	it("ignores unmount() while open", () => {
		const { store } = setup({ defaultOpen: true });
		store.unmount();
		expect(store.mounted).toBe(true);
	});

	it("fills a close press's trigger from the active trigger", () => {
		let seen: PopoverRootChangeEventDetails<PlatformTypes> | undefined;
		const { store } = setup({
			onOpenChange: (_open, details) => {
				seen = details;
			},
		});
		const trigger = element("t");
		store.triggers.add("t", trigger);
		store.setOpen(true, press(trigger), { eventType: "click" });
		store.setOpen(false, createChangeEventDetails(REASONS.closePress, event() as MouseEvent));
		expect(seen?.trigger).toBe(trigger);
	});

	it("claims the only registered trigger for a popup opened without one", () => {
		const { store } = setup({ defaultOpen: true });
		const trigger = element("t");
		store.triggers.add("t", trigger);
		flushSync();
		expect(store.activeTriggerId).toBe("t");
		expect(store.activeTriggerElement).toBe(trigger);
	});

	it("doesn't claim a trigger for an open request that deliberately had none", () => {
		const { store } = setup();
		store.triggers.add("t", element("t"));
		store.openImperatively(true, event("sohedra"), undefined);
		flushSync();
		expect(store.open).toBe(true);
		expect(store.activeTriggerId).toBe(null);
		expect(store.triggerPopupId("t")).toBeUndefined();
	});

	it("prefers the triggerId prop over the active trigger", () => {
		const { props, store } = setup({ triggerId: "b" });
		store.triggers.add("a", element("a"));
		store.setOpen(true, press(element("a")), { eventType: "click" });
		expect(store.activeTriggerId).toBe("b");
		props.triggerId = undefined;
		expect(store.activeTriggerId).toBe(null);
	});

	it("marks keyboard trigger presses, dismissals and focus-outs as instant", () => {
		const { store } = setup();
		store.setOpen(true, press(), { keyboardClick: true, eventType: "click" });
		expect(store.instantType).toBe("click");
		store.setOpen(
			false,
			createChangeEventDetails(REASONS.focusOut, event("focusout") as FocusEvent),
		);
		expect(store.instantType).toBe("focus");
		store.setOpen(true, press(), { eventType: "click" });
		expect(store.instantType).toBeUndefined();
	});

	it("shows `dismiss` while closing by Escape, and not in the next opening from outside", () => {
		const { props, store } = setup();
		store.setOpen(true, press(), { eventType: "click" });
		flushSync();
		store.setOpen(
			false,
			createChangeEventDetails(REASONS.escapeKey, event("keydown") as KeyboardEvent),
		);
		flushSync();
		expect(store.transitionStatus).toBe("ending");
		expect(store.instantType).toBe("dismiss");

		props.open = true;
		expect(store.instantType).toBeUndefined();
		flushSync();
		expect(store.instantType).toBeUndefined();
	});

	it("does not show `focus` from a focus-out close in the next opening from outside", () => {
		const { props, store } = setup();
		store.setOpen(true, press(), { eventType: "click" });
		store.setOpen(
			false,
			createChangeEventDetails(REASONS.focusOut, event("focusout") as FocusEvent),
		);
		flushSync();
		props.open = true;
		flushSync();
		expect(store.instantType).toBeUndefined();
	});

	it("drops trigger-change once closed", () => {
		const { store } = setup({ defaultOpen: true });
		store.setInstantType("trigger-change");
		expect(store.instantType).toBe("trigger-change");
		store.setOpen(false, press());
		expect(store.instantType).toBeUndefined();
	});

	it("sticks a hover-opened popover open for the patient-click threshold", () => {
		const { store, scheduler } = setup();
		const hover = () =>
			store.setOpen(
				true,
				createChangeEventDetails(REASONS.triggerHover, event("mouseenter") as MouseEvent),
			);
		// The flag has no setter: a first hover opening's threshold clears it.
		hover();
		scheduler.advance(PATIENT_CLICK_THRESHOLD);
		hover();
		expect(store.stickIfOpen).toBe(true);
		scheduler.advance(PATIENT_CLICK_THRESHOLD);
		expect(store.stickIfOpen).toBe(false);
	});

	it("clears the open method once closed", () => {
		const { store } = setup();
		store.setOpenMethod("keyboard");
		store.setOpen(true, press(), { eventType: "click" });
		flushSync();
		expect(store.openMethod).toBe("keyboard");
		store.setOpen(false, press());
		flushSync();
		expect(store.openMethod).toBe(null);
	});

	it("keeps the open method a press recorded while the closed popup's triggers change", () => {
		// It is cleared on `open` alone: a press that moves the reference (Combobox's trigger)
		// registers a trigger before the popup opens.
		const { store } = setup();
		store.setOpenMethod("touch");
		store.triggers.add("t", element("t"));
		flushSync();
		expect(store.openMethod).toBe("touch");
	});

	it("traps focus only when modal with a Close part", () => {
		const { store } = setup({ modal: true });
		expect(store.focusManagerModal).toBe(false);
		const release = store.closeParts.register();
		expect(store.focusManagerModal).toBe(true);
		release();
		expect(store.focusManagerModal).toBe(false);
	});

	describe("pressTrigger", () => {
		it("opens a closed popover from the pressed trigger", () => {
			const { store } = setup();
			const trigger = register(store, "t");
			expect(pressTrigger(store, trigger)).toBe(true);
			expect(store.open).toBe(true);
			expect(store.activeTrigger.isOpenedBy("t")).toBe(true);
		});

		it("closes the popover from the trigger that owns it", () => {
			const { store } = setup();
			const trigger = register(store, "t");
			pressTrigger(store, trigger);
			pressTrigger(store, trigger);
			expect(store.open).toBe(false);
		});

		it("moves an open popover to another trigger that is pressed", () => {
			const { store } = setup();
			const first = register(store, "a");
			const second = register(store, "b");
			pressTrigger(store, first);
			pressTrigger(store, second);
			expect(store.open).toBe(true);
			expect(store.activeTrigger.isOpenedBy("b")).toBe(true);
		});

		it("skips the transitions of a press without a pointer", () => {
			const { store } = setup();
			const trigger = register(store, "t");
			pressTrigger(store, trigger, true);
			expect(store.instantType).toBe("click");
		});

		it("returns false when onOpenChange cancels the press", () => {
			const onOpenChange = vi.fn((_open: boolean, details: { cancel(): void }) => details.cancel());
			const { store } = setup({ onOpenChange });
			const trigger = register(store, "t");
			expect(pressTrigger(store, trigger)).toBe(false);
			expect(store.open).toBe(false);
		});
	});

	describe("close", () => {
		it("closes an open popover with the given reason", () => {
			const onOpenChange = vi.fn();
			const { store } = setup({ defaultOpen: true, onOpenChange });
			expect(
				store.close(
					createChangeEventDetails(REASONS.closePress, event("click", { detail: 1 }) as MouseEvent),
				),
			).toBe(true);
			flushSync();
			expect(store.open).toBe(false);
			expect(onOpenChange).toHaveBeenCalledWith(
				false,
				expect.objectContaining({ reason: REASONS.closePress }),
			);
		});
	});

	describe("part state", () => {
		it("gives a trigger its disabled flag and whether the popover is open from it", () => {
			const { store } = setup();
			const trigger = register(store, "t");
			register(store, "other");
			expect(store.triggerState("t", true)).toEqual({ disabled: true, open: false });
			pressTrigger(store, trigger);
			expect(store.triggerState("t", false)).toEqual({ disabled: false, open: true });
			expect(store.triggerState("other", false)).toEqual({ disabled: false, open: false });
		});

		it("gives the Backdrop the open state and the transition status", () => {
			const { store } = setup({ defaultOpen: true });
			expect(store.backdropState).toEqual({
				open: true,
				transitionStatus: store.transitionStatus,
			});
		});

		it("lets the pointer through the Backdrop of a hover-opened popover only", () => {
			const { store } = setup();
			const trigger = register(store, "t");
			store.setOpen(
				true,
				createChangeEventDetails(
					REASONS.triggerHover,
					event("mouseenter", { detail: 1 }) as MouseEvent,
					trigger,
				),
				{
					eventType: "mouseenter",
				},
			);
			flushSync();
			expect(store.backdropPassesPointer).toBe(true);
			store.setOpen(
				false,
				createChangeEventDetails(REASONS.outsidePress, event("click", { detail: 1 }) as MouseEvent),
			);
			flushSync();
			pressTrigger(store, trigger);
			expect(store.backdropPassesPointer).toBe(false);
		});

		it("gives the Popup and the Arrow the popover's state and the Positioner's placement", () => {
			const { store } = setup({ defaultOpen: true });
			const positioner = new PositionerStore(() => ({ keepMounted: false }), {
				initial: initialPosition({ side: "top", align: "start", rtl: false }),
				popup: store,
			});
			expect(popoverPopupState(store, positioner)).toEqual({
				open: true,
				side: "top",
				align: "start",
				instant: store.instantType,
				transitionStatus: store.transitionStatus,
			});
			expect(popoverArrowState(store, positioner)).toEqual({
				open: true,
				side: "top",
				align: "start",
				uncentered: positioner.arrowUncentered,
			});
		});
	});

	describe("hasTriggerFocusGuards", () => {
		/** The store with one registered trigger, `t`, and the two ways to open it from `t`. */
		function setupWithTrigger(initial: Partial<PopoverProps> = {}) {
			const { store } = setup(initial);
			const trigger = element("t");
			store.triggers.add("t", trigger);
			flushSync();
			return {
				store,
				hover() {
					store.setOpen(
						true,
						createChangeEventDetails(
							REASONS.triggerHover,
							event("mouseenter") as MouseEvent,
							trigger,
						),
						{ eventType: "mouseenter" },
					);
					flushSync();
				},
				press() {
					store.setOpen(
						true,
						createChangeEventDetails(REASONS.triggerPress, event("click") as MouseEvent, trigger),
						{ eventType: "click" },
					);
					flushSync();
				},
			};
		}

		it("is true for the trigger that a press opened the popover from", () => {
			const { store, press } = setupWithTrigger();
			expect(store.hasTriggerFocusGuards("t")).toBe(false);
			press();
			expect(store.hasTriggerFocusGuards("t")).toBe(true);
			expect(store.hasTriggerFocusGuards("other")).toBe(false);
		});

		it("is false while a hover holds the popover open, as its focus management is off", () => {
			const { store, hover } = setupWithTrigger();
			hover();
			expect(store.open).toBe(true);
			expect(store.focusManagerDisabled).toBe(true);
			expect(store.hasTriggerFocusGuards("t")).toBe(false);
		});

		it("turns true once a press takes over a hover-opened popover", () => {
			const { store, hover, press } = setupWithTrigger();
			hover();
			press();
			expect(store.open).toBe(true);
			expect(store.focusManagerDisabled).toBe(false);
			expect(store.hasTriggerFocusGuards("t")).toBe(true);
		});

		it("is false for a popover that traps focus", () => {
			const { store, press } = setupWithTrigger({ modal: true });
			store.closeParts.register();
			press();
			expect(store.hasTriggerFocusGuards("t")).toBe(false);
		});
	});
});

describe("PopoverHandle", () => {
	it("ignores imperative calls while no root is attached, and follows the attached root", () => {
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
		const handle = createPopoverHandle();
		const detached = handle.store;
		handle.open("x");
		expect(warn).toHaveBeenCalled();
		expect(handle.isOpen).toBe(false);
		const { store } = setup();
		const detach = handle.attachStore(store, () => event("sohedra"));
		expect(handle.store).toBe(store);
		const trigger = element("x");
		store.triggers.add("x", trigger);
		handle.open("x");
		expect(handle.isOpen).toBe(true);
		expect(store.activeTriggerElement).toBe(trigger);
		handle.close();
		expect(handle.isOpen).toBe(false);
		detach();
		expect(handle.store).toBe(detached);
		warn.mockRestore();
	});

	it("throws when opened with an unregistered trigger id", () => {
		const handle = createPopoverHandle();
		const { store } = setup();
		handle.attachStore(store, () => event("sohedra"));
		expect(() => handle.open("missing")).toThrow(/no matching trigger is registered/);
	});

	it("gives its changes the event the root attached it with, and records an imperative open", () => {
		const onOpenChange = vi.fn();
		const handle = createPopoverHandle();
		const { store } = setup({ onOpenChange });
		const imperative = event("sohedra");
		handle.attachStore(store, () => imperative);
		store.triggers.add("x", element("x"));
		handle.open("x");
		expect(onOpenChange).toHaveBeenLastCalledWith(
			true,
			expect.objectContaining({ reason: REASONS.imperativeAction, event: imperative }),
		);
		expect(store.openEventType).toBe(REASONS.imperativeAction);
		// Not click-like: a press on the owning trigger keeps an imperatively opened popover open.
		expect(store.pressOpen(true)).toBe(true);
		handle.close();
		expect(onOpenChange).toHaveBeenLastCalledWith(
			false,
			expect.objectContaining({ reason: REASONS.imperativeAction, event: imperative }),
		);
	});
});
