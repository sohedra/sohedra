// useTriggerRegistration: a trigger's registration with its popup, driven as a trigger part drives
// it, over getters of reactive values inside an effect root.
import { flushSync } from "svelte";
import { describe, expect, it, vi } from "vitest";

import type { PopoverStore, PopoverTriggerData } from "../../../src/components/popover/index.js";
import { createChangeEventDetails, REASONS } from "../../../src/foundation/kernel/index.js";
import { useTriggerRegistration } from "../../../src/foundation/popup/popup-trigger-registration.svelte.js";
import { root } from "../../kit/kit-effects.svelte.js";
import { createPopover } from "../../kit/kit-popover.svelte.js";
import { element } from "../../kit/kit-stand-ins.js";

const EVENT = {} as never;

/** A Popover store, connected, for the trigger to register with. */
function createPopoverStore() {
	return createPopover({ open: false }).store;
}

function data(payload: string): PopoverTriggerData<unknown> {
	return { payload, disabled: false, openOnHover: false, closeDelay: 0 };
}

/**
 * A trigger part's registration over values a test changes. Each value is raw state, as a part's
 * element is: a deep `$state` would hand the registration a proxy of the stand-in element.
 */
function createTrigger(initial: PopoverStore) {
	let store = $state.raw(initial);
	let current: Element | null = $state.raw(null);
	let forwarded = $state.raw(data("one"));
	const trigger = {
		id: "t",
		get store() {
			return store;
		},
		set store(next) {
			store = next;
		},
		get element() {
			return current;
		},
		set element(next) {
			current = next;
		},
		get data() {
			return forwarded;
		},
		set data(next) {
			forwarded = next;
		},
	};
	const stop = root(() => useTriggerRegistration(() => trigger));
	flushSync();
	return { trigger, stop };
}

function openBy(store: PopoverStore, by: Element) {
	store.setOpen(true, createChangeEventDetails(REASONS.triggerPress, EVENT, by), {
		eventType: "click",
	});
	flushSync();
}

describe("useTriggerRegistration", () => {
	it("registers the element under the trigger's id once it is attached", () => {
		const store = createPopoverStore();
		const { trigger } = createTrigger(store);
		expect(store.triggers.getById("t")).toBeUndefined();

		const button = element("button");
		trigger.element = button;
		flushSync();
		expect(store.triggers.getById("t")).toBe(button);
	});

	it("unregisters when the element goes away and when the trigger does", () => {
		const store = createPopoverStore();
		const { trigger, stop } = createTrigger(store);
		trigger.element = element("button");
		flushSync();
		trigger.element = null;
		flushSync();
		expect(store.triggers.getById("t")).toBeUndefined();

		trigger.element = element("button");
		flushSync();
		stop();
		expect(store.triggers.getById("t")).toBeUndefined();
	});

	it("moves to the store the trigger reads now", () => {
		const first = createPopoverStore();
		const second = createPopoverStore();
		const { trigger } = createTrigger(first);
		const button = element("button");
		trigger.element = button;
		flushSync();

		trigger.store = second;
		flushSync();
		expect(first.triggers.getById("t")).toBeUndefined();
		expect(second.triggers.getById("t")).toBe(button);
	});

	it("registers again when its element changes, not when its data does", () => {
		const store = createPopoverStore();
		const register = vi.spyOn(store, "registerTrigger");
		let current: Element | null = $state.raw(null);
		let forwarded = $state.raw(data("one"));
		// A new options object on each call, built from every value, as a trigger part builds it.
		const stop = root(() =>
			useTriggerRegistration(() => ({ store, id: "t", element: current, data: forwarded })),
		);
		current = element("button");
		flushSync();
		expect(register).toHaveBeenCalledTimes(1);

		forwarded = data("two");
		flushSync();
		expect(register).toHaveBeenCalledTimes(1);

		current = element("button");
		flushSync();
		expect(register).toHaveBeenCalledTimes(2);
		stop();
	});

	it("forwards its data while it owns the mounted popup", () => {
		const store = createPopoverStore();
		const { trigger } = createTrigger(store);
		const button = element("button");
		trigger.element = button;
		flushSync();
		expect(store.payload).toBeUndefined();

		openBy(store, button);
		expect(store.payload).toBe("one");

		trigger.data = data("two");
		flushSync();
		expect(store.payload).toBe("two");
	});
});
