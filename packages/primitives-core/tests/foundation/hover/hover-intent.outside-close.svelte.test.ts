// New cases: hovering after the app closed the popup itself. A bound `open` set to false from
// outside passes no request, so nothing clears the recorded open event (a prop-only reopen still
// needs it) and no open-change event reaches the triggers. Two rules cover it: a click pins a
// popup only while it is open, and a close from outside drops what hover still had pending.
// No DOM: a PopoverStore on the fake platform, `open` bound to `$state` the test writes.

import { flushSync } from "svelte";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
	PATIENT_CLICK_THRESHOLD,
	type PopoverRootChangeEventReason,
	PopoverStore,
	type PopoverStoreProps,
} from "../../../src/components/popover/index.js";
import { isPinnedByClick } from "../../../src/foundation/hover/hover-rules.js";
import {
	HoverInteraction,
	HoverPopupIntent,
	HoverTriggerIntent,
	type HoverTriggerOptions,
	type HoverView,
	SafePolygonSession,
} from "../../../src/foundation/hover/index.js";
import {
	bound,
	createChangeEventDetails,
	type PlatformTypes,
	REASONS,
} from "../../../src/foundation/kernel/index.js";
import { FloatingTree } from "../../../src/foundation/popup/index.js";
import { initialPosition, PositionerStore } from "../../../src/foundation/position/index.js";
import { createFakePlatform, type FakeScheduler } from "../../fake-platform.js";

const event = (type = "click") => ({ type }) as unknown as MouseEvent;
// Opaque stand-ins for elements: core never reads them.
const element = (name: string) => ({ name }) as unknown as HTMLElement;
const details = (reason: PopoverRootChangeEventReason, type = "click") =>
	createChangeEventDetails(reason, event(type));

type Props = PopoverStoreProps<unknown, PlatformTypes> & { open: boolean | undefined };
type MutableProps = { -readonly [K in keyof Props]: Props[K] };

const roots: (() => void)[] = [];
let scheduler: FakeScheduler;

afterEach(() => {
	roots.splice(0).forEach((cleanup) => cleanup());
});

/**
 * A Popover store whose `open` the test owns, one hover trigger and its intent. `close()` and
 * `reopen()` change `open` from outside, the way an app's own code does.
 */
function setup(overrides: Partial<HoverTriggerOptions> = {}) {
	const onOpenChange = vi.fn();
	const props = $state<MutableProps>({
		open: false,
		defaultOpen: undefined,
		triggerId: undefined,
		defaultTriggerId: undefined,
		onOpenChange,
		onOpenChangeComplete: undefined,
		modal: undefined,
	});
	const platform = createFakePlatform();
	scheduler = platform.scheduler;
	// While true the app leaves `open` as it is, whatever the popup asks for.
	let declining = false;
	const store = new PopoverStore(() => props, {
		open: bound(
			() => props.open,
			(next) => {
				if (!declining) {
					props.open = next;
				}
			},
		),
		floatingId: "popup",
		tree: new FloatingTree(),
		nested: false,
		platform: platform,
	});
	roots.push($effect.root(() => store.connect()));
	flushSync();

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
		() => ({
			enabled: true,
			mouseOnly: true,
			restMs: 50,
			delay: undefined,
			safePolygon: false,
			...overrides,
		}),
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

describe("isPinnedByClick", () => {
	it("holds an open popup that a click opened, or that was pressed inside", () => {
		expect(isPinnedByClick(true, "click", false)).toBe(true);
		expect(isPinnedByClick(true, "mousedown", false)).toBe(true);
		expect(isPinnedByClick(true, "mouseenter", true)).toBe(true);
	});

	it("doesn't hold a hover-opened popup", () => {
		expect(isPinnedByClick(true, "mouseenter", false)).toBe(false);
		expect(isPinnedByClick(true, undefined, false)).toBe(false);
	});

	it("holds nothing once the popup is closed, whatever opened it", () => {
		expect(isPinnedByClick(false, "click", false)).toBe(false);
		expect(isPinnedByClick(false, "mousedown", false)).toBe(false);
		expect(isPinnedByClick(false, "mouseenter", true)).toBe(false);
	});
});

describe("HoverInteraction.cancelPending", () => {
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

describe("hovering after a close from outside", () => {
	it("opens again on hover after a click-opened popup was closed from outside", () => {
		const { store, hover, press, close, leave, intent } = setup();
		press();
		expect(store.open).toBe(true);
		// Pinned by the click: leaving the trigger doesn't close it.
		intent.leave(event("mouseleave"), leave);
		expect(store.open).toBe(true);

		close();
		expect(store.open).toBe(false);
		// The open event is kept: a reopen from outside still relies on it.
		expect(store.data.openEventType).toBe("click");

		hover();
		scheduler.advance(50);
		expect(store.open).toBe(true);
		expect(store.openChangeReason).toBe(REASONS.triggerHover);
		expect(store.data.openEventType).toBe("mousemove");
	});

	it("opens again on hover after a click pinned a hover-opened popup", () => {
		const { store, hover, press, close } = setup();
		hover();
		scheduler.advance(50);
		expect(store.open).toBe(true);
		// A press inside the patient-click window keeps it open and takes over the open event.
		scheduler.advance(PATIENT_CLICK_THRESHOLD - 1);
		press();
		expect(store.open).toBe(true);
		expect(store.data.openEventType).toBe("click");

		close();
		hover();
		scheduler.advance(50);
		expect(store.open).toBe(true);
	});

	it("opens again on every hover, not only the first one after the close", () => {
		const { store, hover, press, close } = setup();
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
		const { store, hover, press, close, intent, leave } = setup();
		press();
		close();
		hover();
		scheduler.advance(50);
		expect(store.open).toBe(true);
		intent.leave(event("mouseleave"), leave);
		expect(store.open).toBe(false);
	});

	it("keeps a click-opened popup pinned once it is reopened from outside", () => {
		const { store, press, close, reopen, intent, target, leave } = setup();
		press();
		close();
		reopen();
		expect(store.open).toBe(true);
		expect(store.data.openEventType).toBe("click");

		// Open again and still held by its click: hovering in and out changes nothing.
		intent.enter(event("mouseenter"), target);
		intent.leave(event("mouseleave"), leave);
		scheduler.advance(100);
		expect(store.open).toBe(true);
	});

	it("keeps a hover-opened popup open on a trigger press after a reopen from outside", () => {
		const { store, hover, close, reopen } = setup();
		hover();
		scheduler.advance(50);
		// The patient-click window ends while open.
		scheduler.advance(PATIENT_CLICK_THRESHOLD);
		close();
		// Its exit finished: the next opening starts with a fresh patient-click window.
		store.unmount();
		reopen();
		// The hover that opened it is still on record, so a press keeps it open.
		expect(store.data.openEventType).toBe("mousemove");
		expect(store.pressOpen(true)).toBe(true);
	});

	it("doesn't close a popup pinned from inside when the pointer leaves it, only while open", () => {
		const { store, view, hover, close } = setup();
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

describe("HoverInteraction.closedFromOutside", () => {
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

describe("a pointer resting on the trigger after a close from outside", () => {
	it("keeps a hover-opened popup closed until the pointer leaves and enters again", () => {
		const { store, hover, close, intent, target, leave, onOpenChange } = setup();
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
		const { store, hover, press, close, intent, target, leave, onOpenChange } = setup();
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

describe("a requested close the app undid in the same update", () => {
	it("doesn't let that close stand in for a later close from outside", () => {
		const { store, hover, close, writeOpen, intent, leave, onOpenChange } = setup({
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

describe("a close from outside and pending hover changes", () => {
	it("drops a rest open that was pending, so the popup isn't opened again", () => {
		const { store, hover, close, reopen, onOpenChange } = setup({ restMs: 100 });
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
		const { store, intent, target, close, reopen, onOpenChange } = setup({
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
		const { store, hover, close, intent, leave, onOpenChange } = setup({
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
		const { store, hover, close, intent, leave, onOpenChange } = setup({ safePolygon: true });
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
		const { store, view, hover, close, onOpenChange } = setup();
		const popup = new HoverPopupIntent(view, () => ({ enabled: true, closeDelay: 30 }), flushSync);
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
		const { store, hover, press } = setup();
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
		const { store, hover, close, declined, intent, leave, onOpenChange } = setup({
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
		const { store, hover, intent, leave, onOpenChange } = setup({ restMs: 100 });
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
