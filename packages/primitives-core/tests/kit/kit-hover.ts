// A Popover store with one hover trigger, `t`, and that trigger's hover store, on the fake
// platform: for the tests of the hover job.
import { flushSync } from "svelte";
import { vi } from "vitest";

import {
	HoverTriggerStore,
	type HoverTriggerStoreProps,
} from "../../src/foundation/hover/index.js";
import { REASONS } from "../../src/foundation/kernel/index.js";
import type { PopupView } from "../../src/foundation/popup/index.js";
import { changeDetails as details } from "./kit-details.js";
import { createPopover } from "./kit-popover.svelte.js";
import { element, event } from "./kit-stand-ins.js";

export function hoverTriggerProps(
	overrides: Partial<HoverTriggerStoreProps> = {},
): HoverTriggerStoreProps {
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
 * A Popover store with one hover trigger, `t`, and that trigger's triggerStore with `overrides` on the
 * default options; `flush` is a spy. The trigger doesn't follow the popup's open changes unless a
 * test wires it.
 */
export function createHoverTrigger(overrides: Partial<HoverTriggerStoreProps> = {}) {
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
	const triggerStore = new HoverTriggerStore(() => hoverTriggerProps(overrides), {
		popup: () => result.store as unknown as PopupView,
		flush,
	});
	const target = {
		trigger,
		eventType: "mouseenter" as const,
		overInactiveTrigger: false,
		withinAnchor: true,
	};
	const leave = {
		trigger,
		intoEnabledTrigger: false,
		intoPopup: false,
		clientX: 0,
		clientY: 0,
	};
	return { ...result, onOpenChange, flush, trigger, triggerStore, target, leave };
}

/**
 * A Popover store whose `open` the test owns, one hover trigger that follows the popup's open
 * changes, and its triggerStore (rest 50ms unless `overrides` say otherwise). `close()` and `reopen()`
 * change `open` from outside, the way an app's own code does.
 */
export function createHoverTriggerWithAppOpen(overrides: Partial<HoverTriggerStoreProps> = {}) {
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
	const view = store as unknown as PopupView;
	const triggerStore = new HoverTriggerStore(
		() => hoverTriggerProps({ restMs: 50, ...overrides }),
		{
			popup: () => view,
			flush: flushSync,
		},
	);
	// The trigger follows the popup's open changes, as the platform wires it.
	store.events.on("openchange", (change) => triggerStore.openChanged(change));

	const target = {
		trigger,
		eventType: "mousemove" as const,
		overInactiveTrigger: false,
		withinAnchor: true,
	};
	const leave = {
		trigger,
		intoEnabledTrigger: false,
		intoPopup: false,
		clientX: 0,
		clientY: 0,
	};
	return {
		store,
		view,
		triggerStore,
		target,
		leave,
		onOpenChange,
		scheduler,
		/** The pointer comes onto the trigger and rests there. */
		hover() {
			triggerStore.enter(event("mouseenter"), target);
			triggerStore.move(event("mousemove"), target, 2, 0);
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
