// The popup store's open pipeline (once its own lifecycle class): a change through its kind's
// hooks, an `open` set from outside, a detached store, what it keeps of an opening and for how
// long, the instant type of a new opening, a move to another trigger, and a request the app
// cancelled out.
import { flushSync } from "svelte";
import { describe, expect, it, vi } from "vitest";

import { HoverInteraction } from "../../../src/foundation/hover/index.js";
import { bound, type PlatformTypes, REASONS } from "../../../src/foundation/kernel/index.js";
import {
	type OpenChangeSource,
	type PopupBehavior,
	type PopupHooks,
	PopupStore,
	type PopupStoreProps,
} from "../../../src/foundation/popup/index.js";
import type { PopupChangeEventDetails } from "../../../src/foundation/popup/popup-types.js";
import { changeDetails } from "../../kit/kit-details.js";
import { root } from "../../kit/kit-effects.svelte.js";
import { createFakePlatform } from "../../kit/kit-fake-platform.js";
import { element } from "../../kit/kit-stand-ins.js";

type Details = PopupChangeEventDetails<PlatformTypes>;
type Hooks = PopupHooks<Details, OpenChangeSource, TestStore>;
type Props = PopupStoreProps<Details> & { open: boolean | undefined };
type MutableProps = { -readonly [K in keyof Props]: Props[K] };

const details = (reason: string, trigger?: Element) =>
	changeDetails(reason, "click", trigger) as Details;

const PLAIN: PopupBehavior = { outsidePress: "sloppy" };
const HOVERING: PopupBehavior = {
	outsidePress: "sloppy",
	hover: { mouseOnly: true, delay: "rest" },
};

/** A kind of popup with the hooks a test gives it, and one field of its own for each opening. */
class TestStore extends PopupStore<unknown, PlatformTypes, Details> {
	protected readonly hooks: Hooks;
	/** The kind's own field of one opening: forgotten when the popup unmounts. */
	visits = 0;

	constructor(props: MutableProps, hooks: Hooks, behavior: PopupBehavior, detached?: boolean) {
		super(() => props, {
			open: bound(
				() => props.open,
				(next) => (props.open = next),
			),
			floatingId: "popup",
			tree: null,
			nested: false,
			platform: createFakePlatform(),
			detached,
			kind: { name: "Test", behavior },
		});
		this.hooks = {
			...hooks,
			unmounted: (popup) => {
				this.visits = 0;
				hooks.unmounted?.(popup);
			},
		};
	}
}

function createProps(initial: Partial<MutableProps> = {}) {
	const props = $state<MutableProps>({
		open: undefined,
		defaultOpen: undefined,
		triggerId: undefined,
		defaultTriggerId: undefined,
		onOpenChange: undefined,
		onOpenChangeComplete: undefined,
		...initial,
	});
	return props;
}

/** A popup store on its own, with the hooks a test gives it; `hover` spies on its hover state. */
function setup(
	hooks: Hooks = {},
	initial: Partial<MutableProps> = {},
	options: { detached?: boolean; hover?: boolean } = {},
) {
	const props = createProps(initial);
	const store = new TestStore(props, hooks, options.hover ? HOVERING : PLAIN, options.detached);
	const shared = store.hover ?? new HoverInteraction({ scheduler: store.platform.scheduler });
	const hover = {
		closedFromOutside: vi.spyOn(shared, "closedFromOutside"),
		resetAfterClose: vi.spyOn(shared, "resetAfterClose"),
	};
	root(() => store.connect());
	flushSync();
	return { props, store, hover, scheduler: store.platform.scheduler };
}

describe("PopupStore", () => {
	describe("its hooks", () => {
		it("runs the rule, onOpenChange, the open-change event, the commit, then the hook", () => {
			const order: string[] = [];
			const hooks: Hooks = {
				open: () => {
					order.push("rule");
				},
				opened: (popup) => order.push(`opened:${popup.open}:${popup.openChangeReason}`),
			};
			const { store } = setup(hooks, { onOpenChange: () => order.push("onOpenChange") });
			store.events.on("openchange", () => order.push(`event:${store.open}`));

			expect(store.setOpen(true, details(REASONS.triggerPress))).toBe(true);

			expect(order).toEqual(["rule", "onOpenChange", "event:false", "opened:true:trigger-press"]);
		});

		it("lets a close rule change the details onOpenChange receives", () => {
			const trigger = element("t");
			const onOpenChange = vi.fn();
			const hooks: Hooks = {
				close: (request) => {
					request.details.trigger = trigger;
				},
			};
			const { store } = setup(hooks, { defaultOpen: true, onOpenChange });

			store.setOpen(false, details(REASONS.closePress));

			expect(onOpenChange).toHaveBeenCalledWith(false, expect.objectContaining({ trigger }));
		});

		it("runs no hook for a change onOpenChange cancels", () => {
			const opened = vi.fn();
			const { store } = setup(
				{ opened },
				{ onOpenChange: (_open, eventDetails) => eventDetails.cancel() },
			);

			expect(store.setOpen(true, details(REASONS.triggerPress))).toBe(false);

			expect(opened).not.toHaveBeenCalled();
		});

		it("tells openChanged of an open set from outside, which no request passed", () => {
			const openChanged = vi.fn();
			const opened = vi.fn();
			const { props, store } = setup({ openChanged, opened });
			openChanged.mockClear();

			props.open = true;
			flushSync();
			expect(openChanged).toHaveBeenCalledExactlyOnceWith(true);
			expect(opened).not.toHaveBeenCalled();

			store.setOpenMethod("touch");
			props.open = false;
			flushSync();
			expect(openChanged).toHaveBeenLastCalledWith(false);
			expect(store.openMethod).toBe(null);
		});

		it("never changes and announces nothing when detached", () => {
			const onOpenChange = vi.fn();
			const heard = vi.fn();
			const { store } = setup({}, { onOpenChange }, { detached: true });
			store.events.on("openchange", heard);

			expect(store.setOpen(true, details(REASONS.triggerPress))).toBe(false);
			store.announce(false, details(REASONS.triggerPress), {});

			expect(onOpenChange).not.toHaveBeenCalled();
			expect(heard).not.toHaveBeenCalled();
			expect(store.open).toBe(false);
		});
	});

	describe("its open session", () => {
		it("keeps the reason and the store's extra fields until unmount, and the instant type after it", () => {
			const unmounted = vi.fn();
			const { store } = setup({ unmounted }, { defaultOpen: true });
			store.visits = 3;
			store.setInstantType("dismiss");

			store.setOpen(false, details(REASONS.escapeKey));
			expect(store.openChangeReason).toBe(REASONS.escapeKey);
			expect(store.visits).toBe(3);

			store.unmount();
			expect(store.openChangeReason).toBe(null);
			expect(store.visits).toBe(0);
			expect(store.storedInstantType).toBe("dismiss");
			expect(unmounted).toHaveBeenCalledExactlyOnceWith(store);
		});

		it("forgets the open event on an accepted close, and keeps it when `open` is cleared from outside", () => {
			const { props, store } = setup();
			const click: OpenChangeSource = { eventType: "click" };

			store.setOpen(true, details(REASONS.triggerPress), click);
			expect(store.openEventType).toBe("click");

			// No request passed, so nothing announced the close: as before the session existed.
			props.open = false;
			flushSync();
			expect(store.openEventType).toBe("click");

			store.setOpen(true, details(REASONS.triggerHover), { eventType: "mouseenter" });
			expect(store.openEventType).toBe("mouseenter");
			store.setOpen(false, details(REASONS.outsidePress));
			expect(store.openEventType).toBeUndefined();
			expect(store.openEvent).toBeUndefined();
		});

		it("records the hover that moves an open popup to another trigger, not one on its own trigger", () => {
			const { store } = setup();
			const a = element("a");
			const b = element("b");
			store.activeTrigger.register("a", a, () => {});
			store.activeTrigger.register("b", b, () => {});
			const hover: OpenChangeSource = { eventType: "mouseenter" };

			store.setOpen(true, details(REASONS.triggerPress, a), { eventType: "click" });
			expect(store.openEventType).toBe("click");

			// A hover on the trigger the popup belongs to doesn't take the press away.
			store.setOpen(true, details(REASONS.triggerHover, a), hover);
			expect(store.openEventType).toBe("click");

			// A hover on the other trigger moves the popup: a new opening, by hover.
			const moved = details(REASONS.triggerHover, b);
			store.setOpen(true, moved, hover);
			expect(store.activeTrigger.id).toBe("b");
			expect(store.openEventType).toBe("mouseenter");
			expect(store.openEvent).toBe(moved.event);

			// And back, by hover again.
			store.setOpen(true, details(REASONS.triggerHover, a), hover);
			expect(store.activeTrigger.id).toBe("a");
			expect(store.openEventType).toBe("mouseenter");
		});

		it("keeps the open event for a hover request that names no trigger", () => {
			const { store } = setup();
			const a = element("a");
			store.activeTrigger.register("a", a, () => {});

			store.setOpen(true, details(REASONS.triggerPress, a), { eventType: "click" });
			store.setOpen(true, details(REASONS.triggerHover), { eventType: "mouseenter" });

			expect(store.openEventType).toBe("click");
		});

		it("starts a new close cycle when `open` is set from outside after a kept close", () => {
			const { props, store } = setup(
				{},
				{
					defaultOpen: true,
					onOpenChange: (_open, eventDetails) => eventDetails.preventUnmountOnClose(),
				},
			);

			store.setOpen(false, details(REASONS.outsidePress));
			flushSync();
			expect(store.preventUnmountingOnClose).toBe(true);
			expect(store.awaitingUnmount).toBe(false);

			props.open = true;
			flushSync();
			expect(store.preventUnmountingOnClose).toBe(false);
		});
	});

	describe("the instant type of a new opening", () => {
		// A kind that stores `dismiss` for a close by Escape and keeps the type for any other reason.
		const keepsType: Hooks = {
			closed: (popup, request) => {
				if (request.details.reason === REASONS.escapeKey) {
					popup.setInstantType("dismiss");
				}
			},
		};

		it("shows no type an earlier close stored when `open` is set from outside, and clears it", () => {
			const { props, store } = setup(keepsType);
			const shown = () => store.instantType;
			store.setOpen(true, details(REASONS.triggerPress));
			flushSync();
			store.setOpen(false, details(REASONS.escapeKey));
			flushSync();
			expect(shown()).toBe("dismiss");

			props.open = true;
			// Before the store's watch runs: what the first render of the opening reads.
			expect(shown()).toBeUndefined();
			flushSync();
			expect(store.storedInstantType).toBeUndefined();
			expect(store.heardOpen).toBe(true);
			expect(shown()).toBeUndefined();
		});

		it("drops the stored type before the hook of an accepted opening from closed runs", () => {
			const seen: unknown[] = [];
			const { store } = setup({
				...keepsType,
				opened: (popup) => seen.push(popup.storedInstantType),
			});
			store.setOpen(true, details(REASONS.triggerPress));
			store.setInstantType("focus");
			store.setOpen(false, details(REASONS.escapeKey));
			flushSync();
			store.setOpen(true, details(REASONS.imperativeAction));
			expect(seen).toEqual([undefined, undefined]);
			expect(store.storedInstantType).toBeUndefined();
		});

		it("keeps the type an opening of an open popup stored", () => {
			const { store } = setup(keepsType);
			store.setOpen(true, details(REASONS.triggerFocus));
			store.setInstantType("focus");
			flushSync();
			store.setOpen(true, details(REASONS.imperativeAction));
			flushSync();
			expect(store.storedInstantType).toBe("focus");
		});
	});

	describe("a move to another trigger", () => {
		/** A store with two registered triggers and a follower whose waits the test finishes. */
		function setupMove(initial: Partial<MutableProps> = {}) {
			const setupResult = setup({}, initial);
			const { store } = setupResult;
			const a = element("a");
			const b = element("b");
			store.activeTrigger.register("a", a, () => {});
			store.activeTrigger.register("b", b, () => {});
			const waits: { finish: () => void; cancel: ReturnType<typeof vi.fn> }[] = [];
			const follower = root(() =>
				store.activeTrigger.connectTriggerChange((finish) => {
					const cancel = vi.fn();
					waits.push({ finish, cancel });
					return cancel;
				}),
			);
			flushSync();
			const open = (trigger: Element) => {
				store.setOpen(true, details(REASONS.triggerPress, trigger), { eventType: "click" });
				flushSync();
			};
			return { ...setupResult, a, b, waits, open, follower };
		}

		it("skips transitions as trigger-change once the move to another trigger finished", () => {
			const { store, a, b, waits, open } = setupMove();
			open(a);
			store.setInstantType("click");
			expect(waits).toHaveLength(0);

			open(b);
			// The transitions run once more while the platform waits.
			expect(waits).toHaveLength(1);
			expect(store.storedInstantType).toBeUndefined();

			waits[0]!.finish();
			expect(store.storedInstantType).toBe("trigger-change");
		});

		it("does not wait when the popup opens or stays with the same trigger", () => {
			const { store, a, waits, open } = setupMove();
			open(a);
			store.setOpen(true, details(REASONS.triggerHover, a), { eventType: "mouseenter" });
			flushSync();
			expect(waits).toHaveLength(0);
		});

		it("cancels a pending move when the popup closes, and clears an applied trigger-change", () => {
			const { store, a, b, waits, open } = setupMove();
			open(a);
			open(b);
			store.setOpen(false, details(REASONS.outsidePress));
			flushSync();
			expect(waits[0]!.cancel).toHaveBeenCalled();
			// A late finish of a canceled move changes nothing.
			waits[0]!.finish();
			expect(store.storedInstantType).toBeUndefined();

			open(a);
			expect(waits).toHaveLength(2);
			waits[1]!.finish();
			expect(store.storedInstantType).toBe("trigger-change");
			store.setOpen(false, details(REASONS.outsidePress));
			flushSync();
			expect(store.storedInstantType).toBeUndefined();
		});

		it("leaves another instant type alone when the popup closes", () => {
			const { store, a, open } = setupMove();
			open(a);
			store.setOpen(false, details(REASONS.escapeKey));
			store.setInstantType("dismiss");
			flushSync();
			expect(store.storedInstantType).toBe("dismiss");
		});

		it("cancels the first move when a second one starts", () => {
			const { store, a, b, waits, open } = setupMove();
			open(a);
			open(b);
			open(a);
			expect(waits).toHaveLength(2);
			expect(waits[0]!.cancel).toHaveBeenCalled();
			waits[0]!.finish();
			expect(store.storedInstantType).toBeUndefined();
			waits[1]!.finish();
			expect(store.storedInstantType).toBe("trigger-change");
		});

		it("cancels a pending move when the caller goes away", () => {
			const { a, b, waits, open, follower } = setupMove();
			open(a);
			open(b);
			follower();
			expect(waits[0]!.cancel).toHaveBeenCalled();
		});
	});

	describe("after a request and the app cancelled each other out", () => {
		it("follows the close and the way back, and forgets a kept-mounted close", () => {
			const openChanged = vi.fn();
			const { props, store } = setup(
				{ openChanged },
				{
					open: true,
					onOpenChange: (_open, eventDetails) => eventDetails.preventUnmountOnClose(),
				},
			);
			openChanged.mockClear();

			// A close the app accepts, then the app sets `open` back before effects run.
			expect(store.setOpen(false, details(REASONS.escapeKey))).toBe(true);
			expect(store.preventUnmountingOnClose).toBe(true);
			props.open = true;
			flushSync();

			expect(store.open).toBe(true);
			expect(openChanged.mock.calls).toEqual([[false], [true]]);
			expect(store.preventUnmountingOnClose).toBe(false);
			expect(store.heardOpen).toBe(true);
		});

		it("tells hover of a close from outside once, when an accepted opening was undone", () => {
			const { props, store, hover } = setup({}, { open: false }, { hover: true });
			hover.closedFromOutside.mockClear();

			expect(store.setOpen(true, details(REASONS.triggerPress))).toBe(true);
			props.open = false;
			flushSync();

			expect(store.open).toBe(false);
			expect(hover.closedFromOutside).toHaveBeenCalledTimes(1);
		});

		it("tells hover of a close from outside when the app sets open to false itself", () => {
			const { props, hover } = setup({}, { open: true }, { hover: true });

			props.open = false;
			flushSync();

			expect(hover.closedFromOutside).toHaveBeenCalledTimes(1);
		});

		it("doesn't tell hover of a close the session heard of", () => {
			const { store, hover } = setup({}, { open: true }, { hover: true });

			store.setOpen(false, details(REASONS.escapeKey));
			flushSync();

			expect(hover.closedFromOutside).not.toHaveBeenCalled();
			expect(hover.resetAfterClose).toHaveBeenCalled();
		});
	});
});
