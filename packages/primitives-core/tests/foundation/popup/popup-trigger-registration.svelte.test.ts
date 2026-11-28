// A trigger's registration with its popup, driven as a trigger part drives it: getters over
// reactive values, inside an effect root.

import { flushSync } from "svelte";
import { afterEach, describe, expect, it } from "vitest";

import { PopoverStore, type PopoverTriggerData } from "../../../src/components/popover/index.js";
import { bound, createChangeEventDetails, REASONS } from "../../../src/foundation/kernel/index.js";
import { FloatingTree } from "../../../src/foundation/popup/index.js";
import { useTriggerRegistration } from "../../../src/foundation/popup/popup-trigger-registration.svelte.js";
import { createFakePlatform } from "../../fake-platform.js";

// Opaque stand-ins for trigger elements: core never reads them.
const element = (name: string) => ({ name }) as unknown as Element;
const EVENT = {} as never;

const roots: (() => void)[] = [];
afterEach(() => {
	roots.splice(0).forEach((cleanup) => cleanup());
});

function createPopover() {
	let open: boolean | undefined = $state(false);
	const props = {
		defaultOpen: undefined,
		triggerId: undefined,
		defaultTriggerId: undefined,
		onOpenChange: undefined,
		onOpenChangeComplete: undefined,
		modal: undefined,
	};
	const store = new PopoverStore(() => props, {
		open: bound(
			() => open,
			(next) => (open = next),
		),
		floatingId: "popup",
		tree: new FloatingTree(),
		nested: false,
		platform: createFakePlatform(),
	});
	roots.push($effect.root(() => store.connect()));
	flushSync();
	return store;
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
	const stop = $effect.root(() => useTriggerRegistration(() => trigger));
	roots.push(stop);
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
		const store = createPopover();
		const { trigger } = createTrigger(store);
		expect(store.triggers.getById("t")).toBeUndefined();

		const button = element("button");
		trigger.element = button;
		flushSync();
		expect(store.triggers.getById("t")).toBe(button);
	});

	it("unregisters when the element goes away and when the trigger does", () => {
		const store = createPopover();
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
		const first = createPopover();
		const second = createPopover();
		const { trigger } = createTrigger(first);
		const button = element("button");
		trigger.element = button;
		flushSync();

		trigger.store = second;
		flushSync();
		expect(first.triggers.getById("t")).toBeUndefined();
		expect(second.triggers.getById("t")).toBe(button);
	});

	it("forwards its data while it owns the mounted popup", () => {
		const store = createPopover();
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
