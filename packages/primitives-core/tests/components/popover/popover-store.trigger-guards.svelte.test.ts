// Which trigger renders the focus guards that carry Tab into its popup. A popover a hover opened
// takes no focus, so its popup has no guard to receive it and the trigger renders none either; a
// press on the trigger turns them on again.
// No DOM: the rule on its own, then a PopoverStore on the fake platform.

import { flushSync } from "svelte";
import { afterEach, describe, expect, it } from "vitest";

import {
	PopoverStore,
	type PopoverStoreProps,
	triggerHasFocusGuards,
} from "../../../src/components/popover/index.js";
import {
	bound,
	createChangeEventDetails,
	type PlatformTypes,
	REASONS,
} from "../../../src/foundation/kernel/index.js";
import { FloatingTree } from "../../../src/foundation/popup/index.js";
import { createFakePlatform } from "../../fake-platform.js";

const event = (type: string) => ({ type }) as unknown as MouseEvent;
// An opaque stand-in for the trigger element: core never reads it.
const trigger = { name: "t" } as unknown as Element;

type Props = PopoverStoreProps<unknown, PlatformTypes> & { open: boolean | undefined };
type MutableProps = { -readonly [K in keyof Props]: Props[K] };

const roots: (() => void)[] = [];

afterEach(() => {
	roots.splice(0).forEach((cleanup) => cleanup());
});

/** A Popover store with one registered trigger, `t`. */
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
	store.triggers.add("t", trigger);
	flushSync();
	return {
		store,
		hover() {
			store.setOpen(
				true,
				createChangeEventDetails(REASONS.triggerHover, event("mouseenter"), trigger),
				{ eventType: "mouseenter" },
			);
			flushSync();
		},
		press() {
			store.setOpen(true, createChangeEventDetails(REASONS.triggerPress, event("click"), trigger), {
				eventType: "click",
			});
			flushSync();
		},
	};
}

describe("triggerHasFocusGuards", () => {
	it("gives guards to the trigger that opened a popover without a focus trap", () => {
		expect(triggerHasFocusGuards(true, false, REASONS.triggerPress)).toBe(true);
		expect(triggerHasFocusGuards(true, false, REASONS.none)).toBe(true);
		expect(triggerHasFocusGuards(true, false, null)).toBe(true);
	});

	it("gives none to a trigger that didn't open the popover, or when the popup traps focus", () => {
		expect(triggerHasFocusGuards(false, false, REASONS.triggerPress)).toBe(false);
		expect(triggerHasFocusGuards(true, true, REASONS.triggerPress)).toBe(false);
	});

	it("gives none while a hover holds the popover open", () => {
		expect(triggerHasFocusGuards(true, false, REASONS.triggerHover)).toBe(false);
	});
});

describe("PopoverStore.hasTriggerFocusGuards", () => {
	it("is true for the trigger that a press opened the popover from", () => {
		const { store, press } = setup();
		expect(store.hasTriggerFocusGuards("t")).toBe(false);
		press();
		expect(store.hasTriggerFocusGuards("t")).toBe(true);
		expect(store.hasTriggerFocusGuards("other")).toBe(false);
	});

	it("is false while a hover holds the popover open, as its focus management is off", () => {
		const { store, hover } = setup();
		hover();
		expect(store.open).toBe(true);
		expect(store.focusManagerDisabled).toBe(true);
		expect(store.hasTriggerFocusGuards("t")).toBe(false);
	});

	it("turns true once a press takes over a hover-opened popover", () => {
		const { store, hover, press } = setup();
		hover();
		press();
		expect(store.open).toBe(true);
		expect(store.focusManagerDisabled).toBe(false);
		expect(store.hasTriggerFocusGuards("t")).toBe(true);
	});

	it("is false for a popover that traps focus", () => {
		const { store, press } = setup({ modal: true });
		store.closeParts.register();
		press();
		expect(store.hasTriggerFocusGuards("t")).toBe(false);
	});
});
