// What `PopupLifecycle`, its hooks and its session add to the open pipeline that the decision and
// Popover store tests pin. No DOM.

import { flushSync } from "svelte";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PopoverStore } from "../../../src/components/popover/index.js";
import { HoverInteraction } from "../../../src/foundation/hover/index.js";
import {
	bound,
	createChangeEventDetails,
	type PlatformTypes,
	REASONS,
} from "../../../src/foundation/kernel/index.js";
import {
	FloatingTree,
	type OpenChangeSource,
	type PopupBehavior,
	type PopupHooks,
	PopupStore,
} from "../../../src/foundation/popup/index.js";
import {
	PopupLifecycle,
	type PopupLifecycleOptions,
	type PopupLifecycleProps,
} from "../../../src/foundation/popup/popup-lifecycle.svelte.js";
import { visibleInstantType } from "../../../src/foundation/popup/popup-rules.js";
import type { PopupChangeEventDetails } from "../../../src/foundation/popup/popup-types.js";
import { createFakePlatform } from "../../fake-platform.js";

type Details = PopupChangeEventDetails<PlatformTypes>;
type Extra = { visits: number };
type Hooks = PopupHooks<Details, PlatformTypes, Extra>;
type Props = PopupLifecycleProps<Details> & { open: boolean | undefined };
type MutableProps = { -readonly [K in keyof Props]: Props[K] };

const event = (type = "click") => ({ type }) as unknown as Event;
// Opaque stand-ins for trigger elements: core never reads them.
const element = (name: string) => ({ name }) as unknown as Element;
const details = (reason: string, trigger?: Element) =>
	createChangeEventDetails(reason, event(), trigger) as Details;

const roots: (() => void)[] = [];

afterEach(() => {
	roots.splice(0).forEach((cleanup) => cleanup());
});

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

/** A lifecycle on its own, with the hooks a test gives it. */
function setup(
	hooks: Hooks = {},
	initial: Partial<MutableProps> = {},
	options: {
		lostTrigger?: "keep" | "close";
		detached?: boolean;
		hover?: PopupLifecycleOptions<Details, PlatformTypes, Extra>["hover"];
	} = {},
) {
	const props = createProps(initial);
	const platform = createFakePlatform();
	const lifecycle = new PopupLifecycle<Details, PlatformTypes, Extra>(
		() => props,
		bound(
			() => props.open,
			(next) => (props.open = next),
		),
		{
			name: "Test",
			nested: false,
			detached: options.detached,
			lostTrigger: options.lostTrigger ?? "keep",
			extra: () => ({ visits: 0 }),
			hooks: () => hooks,
			hover: options.hover,
		},
		platform,
	);
	roots.push($effect.root(() => lifecycle.connect()));
	flushSync();
	return { props, lifecycle, scheduler: platform.scheduler };
}

describe("PopupLifecycle hooks", () => {
	it("refuses a change whose rule doesn't call proceed", () => {
		const onOpenChange = vi.fn();
		const opened = vi.fn();
		const { lifecycle } = setup({ open: () => {}, opened }, { onOpenChange });

		expect(lifecycle.request(true, details(REASONS.triggerPress))).toBe(false);

		expect(onOpenChange).not.toHaveBeenCalled();
		expect(opened).not.toHaveBeenCalled();
		expect(lifecycle.open).toBe(false);
		expect(lifecycle.session.reason).toBe(null);
	});

	it("runs the rule, onOpenChange, the open-change event, the commit, then the hook", () => {
		const order: string[] = [];
		const hooks: Hooks = {
			open: (_request, proceed) => {
				order.push("rule");
				proceed();
			},
			opened: (session) => order.push(`opened:${lifecycle.open}:${session.reason}`),
		};
		const { lifecycle } = setup(hooks, { onOpenChange: () => order.push("onOpenChange") });
		lifecycle.events.on("openchange", () => order.push(`event:${lifecycle.open}`));

		expect(lifecycle.request(true, details(REASONS.triggerPress))).toBe(true);

		expect(order).toEqual(["rule", "onOpenChange", "event:false", "opened:true:trigger-press"]);
	});

	it("lets a close rule change the details onOpenChange receives", () => {
		const trigger = element("t");
		const onOpenChange = vi.fn();
		const hooks: Hooks = {
			close: (request, proceed) => {
				request.details.trigger = trigger;
				proceed();
			},
		};
		const { lifecycle } = setup(hooks, { defaultOpen: true, onOpenChange });

		lifecycle.request(false, details(REASONS.closePress));

		expect(onOpenChange).toHaveBeenCalledWith(false, expect.objectContaining({ trigger }));
	});

	it("runs no hook for a change onOpenChange cancels", () => {
		const opened = vi.fn();
		const { lifecycle } = setup(
			{ opened },
			{ onOpenChange: (_open, eventDetails) => eventDetails.cancel() },
		);

		expect(lifecycle.request(true, details(REASONS.triggerPress))).toBe(false);

		expect(opened).not.toHaveBeenCalled();
	});

	it("tells openChanged of an open set from outside, which no request passed", () => {
		const openChanged = vi.fn();
		const opened = vi.fn();
		const { props, lifecycle } = setup({ openChanged, opened });
		openChanged.mockClear();

		props.open = true;
		flushSync();
		expect(openChanged).toHaveBeenCalledExactlyOnceWith(true);
		expect(opened).not.toHaveBeenCalled();

		lifecycle.session.method = "touch";
		props.open = false;
		flushSync();
		expect(openChanged).toHaveBeenLastCalledWith(false);
		expect(lifecycle.session.method).toBe(null);
	});

	it("closes for a lost trigger only when the kind's row says so", () => {
		const run = (lostTrigger: "keep" | "close") => {
			const rule = vi.fn(() => true);
			const { lifecycle, scheduler } = setup({ lostTrigger: rule }, {}, { lostTrigger });
			const trigger = element("t");
			const unregister = lifecycle.activeTrigger.register("t", trigger, () => {});
			lifecycle.request(true, details(REASONS.triggerPress, trigger));
			flushSync();
			unregister();
			flushSync();
			scheduler.runMicrotasks();
			return rule;
		};

		expect(run("close")).toHaveBeenCalledOnce();
		expect(run("keep")).not.toHaveBeenCalled();
	});

	it("never changes and announces nothing when detached", () => {
		const onOpenChange = vi.fn();
		const heard = vi.fn();
		const { lifecycle } = setup({}, { onOpenChange }, { detached: true });
		lifecycle.events.on("openchange", heard);

		expect(lifecycle.request(true, details(REASONS.triggerPress))).toBe(false);
		lifecycle.announce(false, details(REASONS.triggerPress), {});

		expect(onOpenChange).not.toHaveBeenCalled();
		expect(heard).not.toHaveBeenCalled();
		expect(lifecycle.open).toBe(false);
	});
});

describe("OpenSession lifetimes", () => {
	it("keeps the reason and the store's extra fields until unmount, and the instant type after it", () => {
		const unmounted = vi.fn();
		const { lifecycle } = setup({ unmounted }, { defaultOpen: true });
		const session = lifecycle.session;
		session.extra.visits = 3;
		session.instant = "dismiss";

		lifecycle.request(false, details(REASONS.escapeKey));
		expect(session.reason).toBe(REASONS.escapeKey);
		expect(session.extra.visits).toBe(3);

		lifecycle.unmount();
		expect(session.reason).toBe(null);
		expect(session.extra.visits).toBe(0);
		expect(session.instant).toBe("dismiss");
		expect(unmounted).toHaveBeenCalledExactlyOnceWith(session);
	});

	it("forgets the open event on an accepted close, and keeps it when `open` is cleared from outside", () => {
		const { props, lifecycle } = setup();
		const session = lifecycle.session;
		const click: OpenChangeSource = { eventType: "click" };

		lifecycle.request(true, details(REASONS.triggerPress), click);
		expect(session.eventType).toBe("click");

		// No request passed, so nothing announced the close: as before the session existed.
		props.open = false;
		flushSync();
		expect(session.eventType).toBe("click");

		lifecycle.request(true, details(REASONS.triggerHover), { eventType: "mouseenter" });
		expect(session.eventType).toBe("mouseenter");
		lifecycle.request(false, details(REASONS.outsidePress));
		expect(session.eventType).toBeUndefined();
		expect(session.event).toBeUndefined();
	});

	it("records the hover that moves an open popup to another trigger, not one on its own trigger", () => {
		const { lifecycle } = setup();
		const session = lifecycle.session;
		const a = element("a");
		const b = element("b");
		lifecycle.activeTrigger.register("a", a, () => {});
		lifecycle.activeTrigger.register("b", b, () => {});
		const hover: OpenChangeSource = { eventType: "mouseenter" };

		lifecycle.request(true, details(REASONS.triggerPress, a), { eventType: "click" });
		expect(session.eventType).toBe("click");

		// A hover on the trigger the popup belongs to doesn't take the press away.
		lifecycle.request(true, details(REASONS.triggerHover, a), hover);
		expect(session.eventType).toBe("click");

		// A hover on the other trigger moves the popup: a new opening, by hover.
		const moved = details(REASONS.triggerHover, b);
		lifecycle.request(true, moved, hover);
		expect(lifecycle.activeTrigger.id).toBe("b");
		expect(session.eventType).toBe("mouseenter");
		expect(session.event).toBe(moved.event);

		// And back, by hover again.
		lifecycle.request(true, details(REASONS.triggerHover, a), hover);
		expect(lifecycle.activeTrigger.id).toBe("a");
		expect(session.eventType).toBe("mouseenter");
	});

	it("keeps the open event for a hover request that names no trigger", () => {
		const { lifecycle } = setup();
		const a = element("a");
		lifecycle.activeTrigger.register("a", a, () => {});

		lifecycle.request(true, details(REASONS.triggerPress, a), { eventType: "click" });
		lifecycle.request(true, details(REASONS.triggerHover), { eventType: "mouseenter" });

		expect(lifecycle.session.eventType).toBe("click");
	});

	it("starts a new close cycle when `open` is set from outside after a kept close", () => {
		const { props, lifecycle } = setup(
			{},
			{
				defaultOpen: true,
				onOpenChange: (_open, eventDetails) => eventDetails.preventUnmountOnClose(),
			},
		);

		lifecycle.request(false, details(REASONS.outsidePress));
		flushSync();
		expect(lifecycle.session.preventUnmount).toBe(true);
		expect(lifecycle.awaitingUnmount).toBe(false);

		props.open = true;
		flushSync();
		expect(lifecycle.session.preventUnmount).toBe(false);
	});
});

describe("PopupLifecycle instant type of a new opening", () => {
	// A kind that stores `dismiss` for a close by Escape and keeps the type for any other reason.
	const keepsType: Hooks = {
		closed: (session, request) => {
			if (request.details.reason === REASONS.escapeKey) {
				session.instant = "dismiss";
			}
		},
	};

	it("shows no type an earlier close stored when `open` is set from outside, and clears it", () => {
		const { props, lifecycle } = setup(keepsType);
		const shown = () =>
			visibleInstantType(lifecycle.session.instant, lifecycle.open, lifecycle.heardOpen);
		lifecycle.request(true, details(REASONS.triggerPress));
		flushSync();
		lifecycle.request(false, details(REASONS.escapeKey));
		flushSync();
		expect(shown()).toBe("dismiss");

		props.open = true;
		// Before the lifecycle's watch runs: what the first render of the opening reads.
		expect(shown()).toBeUndefined();
		flushSync();
		expect(lifecycle.session.instant).toBeUndefined();
		expect(lifecycle.heardOpen).toBe(true);
		expect(shown()).toBeUndefined();
	});

	it("drops the stored type before the hook of an accepted opening from closed runs", () => {
		const seen: unknown[] = [];
		const { lifecycle } = setup({
			...keepsType,
			opened: (session) => seen.push(session.instant),
		});
		lifecycle.request(true, details(REASONS.triggerPress));
		lifecycle.session.instant = "focus";
		lifecycle.request(false, details(REASONS.escapeKey));
		flushSync();
		lifecycle.request(true, details(REASONS.imperativeAction));
		expect(seen).toEqual([undefined, undefined]);
		expect(lifecycle.session.instant).toBeUndefined();
	});

	it("keeps the type an opening of an open popup stored", () => {
		const { lifecycle } = setup(keepsType);
		lifecycle.request(true, details(REASONS.triggerFocus));
		lifecycle.session.instant = "focus";
		flushSync();
		lifecycle.request(true, details(REASONS.imperativeAction));
		flushSync();
		expect(lifecycle.session.instant).toBe("focus");
	});
});

describe("PopupLifecycle trigger change", () => {
	/** A lifecycle with two registered triggers and a follower whose waits the test finishes. */
	function setupMove(initial: Partial<MutableProps> = {}) {
		const setupResult = setup({}, initial);
		const { lifecycle } = setupResult;
		const a = element("a");
		const b = element("b");
		lifecycle.activeTrigger.register("a", a, () => {});
		lifecycle.activeTrigger.register("b", b, () => {});
		const waits: { finish: () => void; cancel: ReturnType<typeof vi.fn> }[] = [];
		const follower = $effect.root(() =>
			lifecycle.connectTriggerChange((finish) => {
				const cancel = vi.fn();
				waits.push({ finish, cancel });
				return cancel;
			}),
		);
		roots.push(follower);
		flushSync();
		const open = (trigger: Element) => {
			lifecycle.request(true, details(REASONS.triggerPress, trigger), { eventType: "click" });
			flushSync();
		};
		return { ...setupResult, a, b, waits, open, follower };
	}

	it("skips transitions as trigger-change once the move to another trigger finished", () => {
		const { lifecycle, a, b, waits, open } = setupMove();
		open(a);
		lifecycle.session.instant = "click";
		expect(waits).toHaveLength(0);

		open(b);
		// The transitions run once more while the platform waits.
		expect(waits).toHaveLength(1);
		expect(lifecycle.session.instant).toBeUndefined();

		waits[0]!.finish();
		expect(lifecycle.session.instant).toBe("trigger-change");
	});

	it("does not wait when the popup opens or stays with the same trigger", () => {
		const { lifecycle, a, waits, open } = setupMove();
		open(a);
		lifecycle.request(true, details(REASONS.triggerHover, a), { eventType: "mouseenter" });
		flushSync();
		expect(waits).toHaveLength(0);
	});

	it("cancels a pending move when the popup closes, and clears an applied trigger-change", () => {
		const { lifecycle, a, b, waits, open } = setupMove();
		open(a);
		open(b);
		lifecycle.request(false, details(REASONS.outsidePress));
		flushSync();
		expect(waits[0]!.cancel).toHaveBeenCalled();
		// A late finish of a canceled move changes nothing.
		waits[0]!.finish();
		expect(lifecycle.session.instant).toBeUndefined();

		open(a);
		expect(waits).toHaveLength(2);
		waits[1]!.finish();
		expect(lifecycle.session.instant).toBe("trigger-change");
		lifecycle.request(false, details(REASONS.outsidePress));
		flushSync();
		expect(lifecycle.session.instant).toBeUndefined();
	});

	it("leaves another instant type alone when the popup closes", () => {
		const { lifecycle, a, open } = setupMove();
		open(a);
		lifecycle.request(false, details(REASONS.escapeKey));
		lifecycle.session.instant = "dismiss";
		flushSync();
		expect(lifecycle.session.instant).toBe("dismiss");
	});

	it("cancels the first move when a second one starts", () => {
		const { lifecycle, a, b, waits, open } = setupMove();
		open(a);
		open(b);
		open(a);
		expect(waits).toHaveLength(2);
		expect(waits[0]!.cancel).toHaveBeenCalled();
		waits[0]!.finish();
		expect(lifecycle.session.instant).toBeUndefined();
		waits[1]!.finish();
		expect(lifecycle.session.instant).toBe("trigger-change");
	});

	it("cancels a pending move when the caller goes away", () => {
		const { a, b, waits, open, follower } = setupMove();
		open(a);
		open(b);
		follower();
		expect(waits[0]!.cancel).toHaveBeenCalled();
	});
});

describe("PopupStore", () => {
	const plain: PopupBehavior = { outsidePress: "sloppy", side: "bottom", lostTrigger: "keep" };

	/** A kind whose behaviour row has no `hover`. */
	class PlainStore extends PopupStore {
		protected readonly hooks = {};

		constructor(props: MutableProps) {
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

	function createPopover(initial: { modal?: boolean | "trap-focus" } = {}) {
		const props = $state({ ...createProps(), modal: initial.modal });
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
		return { props, store };
	}

	it("builds hover state only for a kind whose behaviour row has hover", () => {
		const store = new PlainStore(createProps());
		roots.push($effect.root(() => store.connect()));
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

		expect(createPopover().store.hover).toBeInstanceOf(HoverInteraction);
	});

	it("dismisses a focus-trapping popover on the press itself, for a mouse too", () => {
		const { props, store } = createPopover();
		expect(store.outsidePressEvent).toEqual({ mouse: "intentional", touch: "sloppy" });
		props.modal = true;
		expect(store.outsidePressEvent).toEqual({ mouse: "intentional", touch: "sloppy" });
		props.modal = "trap-focus";
		expect(store.outsidePressEvent).toEqual({ mouse: "sloppy", touch: "sloppy" });
	});
});

describe("PopupLifecycle after a request and the app cancelled each other out", () => {
	it("follows the close and the way back, and forgets a kept-mounted close", () => {
		const openChanged = vi.fn();
		const { props, lifecycle } = setup(
			{ openChanged },
			{
				open: true,
				onOpenChange: (_open, eventDetails) => eventDetails.preventUnmountOnClose(),
			},
		);
		openChanged.mockClear();

		// A close the app accepts, then the app sets `open` back before effects run.
		expect(lifecycle.request(false, details(REASONS.escapeKey))).toBe(true);
		expect(lifecycle.session.preventUnmount).toBe(true);
		props.open = true;
		flushSync();

		expect(lifecycle.open).toBe(true);
		expect(openChanged.mock.calls).toEqual([[false], [true]]);
		expect(lifecycle.session.preventUnmount).toBe(false);
		expect(lifecycle.heardOpen).toBe(true);
	});

	it("tells hover of a close from outside once, when an accepted opening was undone", () => {
		const hover = { closedFromOutside: vi.fn(), resetAfterClose: vi.fn(), dispose: vi.fn() };
		const { props, lifecycle } = setup({}, { open: false }, { hover });
		hover.closedFromOutside.mockClear();

		expect(lifecycle.request(true, details(REASONS.triggerPress))).toBe(true);
		props.open = false;
		flushSync();

		expect(lifecycle.open).toBe(false);
		expect(hover.closedFromOutside).toHaveBeenCalledTimes(1);
	});

	it("tells hover of a close from outside when the app sets open to false itself", () => {
		const hover = { closedFromOutside: vi.fn(), resetAfterClose: vi.fn(), dispose: vi.fn() };
		const { props } = setup({}, { open: true }, { hover });

		props.open = false;
		flushSync();

		expect(hover.closedFromOutside).toHaveBeenCalledTimes(1);
	});

	it("doesn't tell hover of a close the session heard of", () => {
		const hover = { closedFromOutside: vi.fn(), resetAfterClose: vi.fn(), dispose: vi.fn() };
		const { lifecycle } = setup({}, { open: true }, { hover });

		lifecycle.request(false, details(REASONS.escapeKey));
		flushSync();

		expect(hover.closedFromOutside).not.toHaveBeenCalled();
		expect(hover.resetAfterClose).toHaveBeenCalled();
	});
});
