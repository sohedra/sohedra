// The decisions Popover's parts ask the store for: the press on a trigger, a close from outside a
// trigger, and the state objects of the Trigger, Backdrop, Popup and Arrow. Written from the cases
// of the trigger, backdrop, popup and arrow part tests. No DOM.

import { flushSync } from "svelte";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
	popoverArrowState,
	popoverPopupState,
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
import { initialPosition, PositionerStore } from "../../../src/foundation/position/index.js";
import { createFakePlatform } from "../../fake-platform.js";

const event = (type = "click", detail = 1) => ({ type, detail }) as unknown as MouseEvent;
// Opaque stand-ins for trigger elements: core never reads them.
const element = (name: string) => ({ name }) as unknown as Element;

type Props = PopoverStoreProps<unknown, PlatformTypes> & { open: boolean | undefined };
type MutableProps = { -readonly [K in keyof Props]: Props[K] };

const roots: (() => void)[] = [];

afterEach(() => {
	roots.splice(0).forEach((cleanup) => cleanup());
});

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
	const store = new PopoverStore(() => props, {
		open: bound(
			() => props.open,
			(next) => (props.open = next),
		),
		floatingId: "popup",
		tree: new FloatingTree(),
		nested: false,
		platform: createFakePlatform(),
	});
	roots.push($effect.root(() => store.connect()));
	flushSync();
	return { props, store };
}

/** A trigger registered with the store, as Popover.Trigger registers it. */
function register(store: PopoverStore, id: string) {
	const trigger = element(id);
	roots.push(
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

function pressTrigger(store: PopoverStore, trigger: Element, keyboard = false) {
	const accepted = store.pressTrigger(
		trigger,
		createChangeEventDetails(REASONS.triggerPress, event("click", keyboard ? 0 : 1), trigger),
		{ keyboardClick: keyboard, eventType: "click" },
	);
	flushSync();
	return accepted;
}

describe("PopoverStore.pressTrigger", () => {
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

describe("PopoverStore.close", () => {
	it("closes an open popover with the given reason", () => {
		const onOpenChange = vi.fn();
		const { store } = setup({ defaultOpen: true, onOpenChange });
		expect(store.close(createChangeEventDetails(REASONS.closePress, event()))).toBe(true);
		flushSync();
		expect(store.open).toBe(false);
		expect(onOpenChange).toHaveBeenCalledWith(
			false,
			expect.objectContaining({ reason: REASONS.closePress }),
		);
	});
});

describe("Popover part state", () => {
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
		expect(store.backdropState).toEqual({ open: true, transitionStatus: store.transitionStatus });
	});

	it("lets the pointer through the Backdrop of a hover-opened popover only", () => {
		const { store } = setup();
		const trigger = register(store, "t");
		store.setOpen(
			true,
			createChangeEventDetails(REASONS.triggerHover, event("mouseenter"), trigger),
			{
				eventType: "mouseenter",
			},
		);
		flushSync();
		expect(store.backdropPassesPointer).toBe(true);
		store.setOpen(false, createChangeEventDetails(REASONS.outsidePress, event()));
		flushSync();
		pressTrigger(store, trigger);
		expect(store.backdropPassesPointer).toBe(false);
	});

	it("gives the Popup and the Arrow the popover's state and the Positioner's placement", () => {
		const { store } = setup({ defaultOpen: true });
		const positioner = new PositionerStore({
			initial: initialPosition({ side: "top", align: "start", rtl: false }),
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
