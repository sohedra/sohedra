// The popup open pipeline without a DOM.

import { flushSync } from "svelte";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
	createPopoverHandle,
	PATIENT_CLICK_THRESHOLD,
	type PopoverRootChangeEventDetails,
	PopoverStore,
	type PopoverStoreProps,
} from "../../../src/components/popover/index.js";
import {
	bound,
	createChangeEventDetails,
	type PlatformTypes,
	REASONS,
} from "../../../src/foundation/kernel/index.js";
import { FloatingTree } from "../../../src/foundation/popup/index.js";
import { createFakePlatform, type FakeScheduler } from "../../kit/kit-fake-platform.js";

const event = (type = "click") => ({ type }) as unknown as Event;
// Opaque stand-ins for trigger elements: core never reads them.
const element = (name: string) => ({ name }) as unknown as Element;

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
	const platform = createFakePlatform();
	scheduler = platform.scheduler;
	const store = new PopoverStore(() => props, {
		open: bound(
			() => props.open,
			(next) => (props.open = next),
		),
		floatingId: "popup",
		tree: new FloatingTree(),
		nested: false,
		platform: platform,
	});
	roots.push($effect.root(() => store.connect()));
	flushSync();
	return { props, store };
}

const press = (trigger?: Element) =>
	createChangeEventDetails(REASONS.triggerPress, event() as MouseEvent, trigger);

// Time comes from the fake platform's scheduler, which the tests step.
let scheduler: FakeScheduler;

afterEach(() => {
	roots.splice(0).forEach((cleanup) => cleanup());
});

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
		const { store } = setup();
		store.stickIfOpen = false;
		store.setOpen(
			true,
			createChangeEventDetails(REASONS.triggerHover, event("mouseenter") as MouseEvent),
		);
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
});

describe("PopoverStore.report", () => {
	it("commits a change that already happened: onOpenChange runs, cancel() has no effect", () => {
		const onOpenChange = vi.fn((_open: boolean, details: { cancel(): void }) => details.cancel());
		const { props, store } = setup({ defaultOpen: true, onOpenChange });
		const seen = vi.fn();
		store.events.on("openchange", seen);
		// A platform reason (a back key) the web doesn't have.
		store.report(false, createChangeEventDetails("back-button", event("back")));
		expect(onOpenChange).toHaveBeenCalledWith(
			false,
			expect.objectContaining({ reason: "back-button", isCanceled: true }),
		);
		expect(seen).toHaveBeenCalledWith(expect.objectContaining({ open: false }));
		expect(store.open).toBe(false);
		expect(props.open).toBe(false);
		expect(store.openChangeReason).toBe("back-button");
	});

	it("keeps the popup mounted for unmount() after preventUnmountOnClose()", () => {
		const { store } = setup({
			defaultOpen: true,
			onOpenChange: (_open, details) => details.preventUnmountOnClose(),
		});
		flushSync();
		store.report(false, createChangeEventDetails("back-button", event("back")));
		expect(store.preventUnmountingOnClose).toBe(true);
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
		expect(store.data.openEventType).toBe(REASONS.imperativeAction);
		// Not click-like: a press on the owning trigger keeps an imperatively opened popover open.
		expect(store.pressOpen(true)).toBe(true);
		handle.close();
		expect(onOpenChange).toHaveBeenLastCalledWith(
			false,
			expect.objectContaining({ reason: REASONS.imperativeAction, event: imperative }),
		);
	});
});
