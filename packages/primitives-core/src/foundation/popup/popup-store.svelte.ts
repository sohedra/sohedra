import { untrack } from "svelte";

import {
	type DismissChangeDetails,
	DismissInteraction,
	type DismissOptions,
	type OutsidePressEvent,
} from "../dismiss/index.js";
import { HoverInteraction } from "../hover/index.js";
import {
	type AnyPlatformEvent,
	type Bound,
	bound,
	callUser,
	Controllable,
	createChangeEventDetails,
	type InteractionEventType,
	OwnedValue,
	type Platform,
	type PlatformEvent,
	type PlatformTypes,
	REASONS,
	watch,
} from "../kernel/index.js";
import type { PositionerStore } from "../position/index.js";
import { Presence, type TransitionStatus } from "../presence/index.js";
import { ActiveTriggerStore } from "./popup-active-trigger-store.svelte.js";
import type { PopupBehavior } from "./popup-behavior.js";
import { EventEmitter } from "./popup-event-emitter.js";
import type {
	FloatingNode,
	FloatingNodeContextValue,
	FloatingTree,
} from "./popup-floating-tree.js";
import {
	awaitsUnmount,
	closesUnheard,
	keepsOpenEvent,
	namesOtherTrigger,
	opensUnheard,
	openValuesToFollow,
	visibleInstantType,
} from "./popup-rules.js";
import { PopupTriggerMap } from "./popup-trigger-map.js";
import type {
	InstantType,
	InteractionType,
	OpenChangeSource,
	PopupChangeEventDetails,
	PopupEvents,
	PopupInteractionData,
	PopupTriggerData,
} from "./popup-types.js";

/** The popup Root props every popup store reads. The `open` binding is one of the deps. */
export interface PopupStoreProps<Details> {
	readonly defaultOpen: boolean | undefined;
	/** The controlled id of the trigger the popup belongs to. */
	readonly triggerId: string | null | undefined;
	readonly defaultTriggerId: string | null | undefined;
	readonly onOpenChange: ((open: boolean, details: Details) => void) | undefined;
	readonly onOpenChangeComplete: ((open: boolean) => void) | undefined;
}

/** One request to open or close a popup. */
export interface PopupRequest<Details, Source extends OpenChangeSource = OpenChangeSource> {
	readonly next: boolean;
	/** The change details `onOpenChange` receives. A `close` rule may fill in its `trigger`. */
	readonly details: Details;
	/** What the platform knows about the change. */
	readonly source: Source;
}

/**
 * What a kind of popup adds to the shared open pipeline. A store passes hooks in place of
 * writing its own `setOpen`; every rule is optional. `popup` is the store the hooks belong to.
 */
export interface PopupHooks<
	Details,
	Source extends OpenChangeSource = OpenChangeSource,
	Popup = unknown,
> {
	/** Before an opening, which it may adjust (its details). */
	open?(request: PopupRequest<Details, Source>): void;
	/** Before a close, which it may adjust (its details). */
	close?(request: PopupRequest<Details, Source>): void;
	/** After an accepted opening. */
	opened?(popup: Popup, request: PopupRequest<Details, Source>): void;
	/** After an accepted close. */
	closed?(popup: Popup, request: PopupRequest<Details, Source>): void;
	/**
	 * `open` turned true or false, by a request or from outside (a bound `open`). Runs in an
	 * effect, after the update.
	 */
	openChanged?(open: boolean): void;
	/** The popup unmounted: the opening is over, so the kind forgets what it kept of it. */
	unmounted?(popup: Popup): void;
}

/** What a popup store is given once, from around its Root. */
export interface PopupStoreDeps<T extends PlatformTypes = PlatformTypes> {
	/** The `open` binding. */
	readonly open: Bound<boolean | undefined>;
	/** The popup element's generated id. */
	readonly floatingId: string;
	/** The tree of nested popups, shared with ancestors. */
	readonly tree: FloatingTree<T> | null;
	/** Whether the popup is nested in another floating element. */
	readonly nested: boolean;
	/** The platform the popup runs on; its helpers and child stores use it too. */
	readonly platform: Platform<T>;
	/** An inert store for a handle without a Root: it never opens. */
	readonly detached?: boolean | undefined;
}

/** What a kind of popup fixes about its store. */
export interface PopupStoreKind {
	/** The component name in warnings, e.g. `Popover`. */
	readonly name: string;
	/** The kind's row of the behaviour table. */
	readonly behavior: PopupBehavior;
}

/**
 * What every popup's parts and interactions share: the open state and the one pipeline that
 * changes it (`onOpenChange` first, which may cancel or call `preventUnmountOnClose()`, then the
 * open-change event, then the commit), the presence, the triggers and the payload of the one
 * that owns the popup, the popup and positioner elements and the node in the floating tree. A
 * kind's store extends it once and passes its {@link hooks}; it writes no `setOpen` of its own.
 *
 * The platform reports both ends of the presence: {@link completeOpen} once the enter animations
 * finished, {@link unmount} once the exit animations did.
 */
export abstract class PopupStore<
	Payload = unknown,
	T extends PlatformTypes = PlatformTypes,
	Details extends PopupChangeEventDetails<T> = PopupChangeEventDetails<T>,
	Source extends OpenChangeSource = OpenChangeSource,
> implements FloatingNodeContextValue<T> {
	// 1. Inputs
	/** The kind's hooks for the open pipeline. A field: a change reads it when it runs. */
	protected abstract readonly hooks: PopupHooks<Details, Source, this>;
	readonly #props: () => PopupStoreProps<Details>;
	readonly #detached: boolean;

	/** The component name in warnings, e.g. `Popover`. */
	readonly name: string;
	/** The kind's row of the behaviour table: which interactions its parts wire. */
	readonly behavior: PopupBehavior;
	/** The popup element's generated id. */
	readonly floatingId: string;
	/** The tree of nested popups, shared with ancestors. */
	readonly tree: FloatingTree<T> | null;
	/** Whether the popup is nested in another floating element. */
	readonly nested: boolean;
	/** The platform the popup runs on; its helpers and child stores use it too. */
	readonly platform: Platform<T>;

	// 2. Owned objects
	readonly #open: Controllable<boolean>;
	readonly presence: Presence;
	/** The popup's registered triggers. */
	readonly triggers: PopupTriggerMap<T> = new PopupTriggerMap<T>();
	/** Which registered trigger the popup belongs to. */
	readonly activeTrigger: ActiveTriggerStore<T>;
	/** The popup's own events: open changes, which its interactions follow. */
	readonly events: EventEmitter<PopupEvents<T>> = new EventEmitter<PopupEvents<T>>();
	/**
	 * The hover state the trigger and popup hover interactions share, for a kind whose behaviour
	 * row has `hover`; `null` for one hover never opens.
	 */
	readonly hover: HoverInteraction<T> | null;
	/**
	 * The popup's dismissal: Escape, a press on a trigger and presses outside. The platform calls
	 * it with what happened; {@link dismissOptions} are the kind's answers.
	 */
	readonly dismiss: DismissInteraction<T>;
	/** The mounted Positioner's measured state (for the safe polygon's side). */
	readonly positionerClaim: OwnedValue<PositionerStore<T>> = new OwnedValue<PositionerStore<T>>();
	/** The popup element's id: the Popup part's (it may be the user's), else `floatingId`. */
	readonly popupIdClaim: OwnedValue<string> = new OwnedValue<string>();
	/**
	 * Bookkeeping the interactions share and nothing renders from. The open event and its type
	 * are the store's.
	 */
	readonly data: PopupInteractionData<T>;
	/** Whether Escape and outside presses inside the popup also reach its ancestors. */
	readonly dismissBubbles: { readonly escapeKey: boolean; readonly outsidePress: boolean } = {
		escapeKey: false,
		outsidePress: true,
	};

	readonly #outsidePress: OutsidePressEvent;
	#popupElement: T["element"] | null = $state.raw(null);
	#positionerElement: T["element"] | null = $state.raw(null);
	#payload: Payload | undefined = $state.raw();

	/** Why it last opened or closed. Written by each accepted change; cleared on unmount. */
	#reason: string | null = $state(null);
	/** Whether a close waits for `unmount()`. Set by a close; cleared by an opening, unmount. */
	#preventUnmount = $state(false);
	/** The input that opened it. Set by the trigger before it opens; cleared when it closes. */
	#method: InteractionType | null = $state(null);
	/** Why transitions are skipped, as stored. Set by changes and parts; cleared by an opening. */
	#instant: InstantType = $state();
	/** The event that opened it. Set by an accepted opening (`keepsOpenEvent`); cleared on close. */
	#openEvent: AnyPlatformEvent<T> | undefined = undefined;
	/** That event's type, in core's words. Set and cleared with the open event. */
	#openEventType: InteractionEventType | undefined = undefined;

	// An open change is running; an unmount asked for during it waits for its commit.
	#changing = false;
	#pendingUnmount = false;
	// The open value the store last heard of: committed by an accepted change, or seen by the
	// watch on `open` after a change from outside, which is when an opening must not show what an
	// earlier one stored. A close not heard of when the watch runs came from outside.
	#heardOpen = $state(false);

	// 3. Public state. `$derived.by` because the owned objects are built in the constructor, after
	// these initialisers.
	readonly mounted: boolean = $derived.by(() => this.presence.mounted);
	readonly transitionStatus: TransitionStatus = $derived.by(() => this.presence.transitionStatus);
	/** The id of the trigger the popup belongs to: the controlled `triggerId`, else its own. */
	readonly activeTriggerId: string | null = $derived.by(() => this.activeTrigger.id);
	/** The active trigger element, while the popup is mounted. */
	readonly activeTriggerElement: T["element"] | null = $derived.by(
		() => this.activeTrigger.element,
	);
	/**
	 * The element the popup is anchored to and returns focus to: the active trigger, or the last
	 * one while unmounted.
	 */
	readonly anchorElement: T["element"] | null = $derived.by(() => this.activeTrigger.anchor);
	/** Why the popup skips its transitions (`data-instant`). */
	readonly instantType: InstantType = $derived.by(() =>
		visibleInstantType(this.#instant, this.open, this.#heardOpen),
	);
	/** Whether a closed popup is waiting for its exit animations before unmounting. */
	readonly awaitingUnmount: boolean = $derived.by(() =>
		awaitsUnmount(this.open, this.presence.mounted, this.#preventUnmount),
	);
	/** The floating element: the Positioner. */
	readonly floatingElement: T["element"] | null = $derived.by(() => this.#positionerElement);
	readonly popupId: string | undefined = $derived.by(
		() => this.popupIdClaim.current ?? (this.floatingId || undefined),
	);

	/** Pure: reads no context. `props` is called inside the deriveds, so each prop stays reactive. */
	constructor(
		props: () => PopupStoreProps<Details>,
		deps: PopupStoreDeps<T> & { readonly kind: PopupStoreKind },
	) {
		const { kind, platform } = deps;
		this.#props = props;
		this.#detached = deps.detached ?? false;
		this.name = kind.name;
		this.behavior = kind.behavior;
		this.floatingId = deps.floatingId;
		this.tree = deps.tree;
		this.nested = deps.nested;
		this.platform = platform;
		this.#outsidePress = kind.behavior.outsidePress;
		this.#open = new Controllable<boolean>(deps.open, {
			default: () => props().defaultOpen ?? false,
			name: kind.name,
			state: "open",
		});
		this.#heardOpen = untrack(() => this.#open.current);
		this.presence = new Presence(this, platform.scheduler);
		this.activeTrigger = new ActiveTriggerStore<T>(
			() => ({
				open: this.open,
				mounted: this.presence.mounted,
				triggerId: props().triggerId,
				defaultTriggerId: props().defaultTriggerId,
			}),
			{
				triggers: this.triggers,
				instant: bound(
					() => this.#instant,
					(value) => (this.#instant = value),
				),
			},
		);
		this.hover = kind.behavior.hover ? new HoverInteraction<T>(platform.scheduler) : null;
		this.dismiss = new DismissInteraction<T>(
			this,
			() => this.dismissOptions,
			// A generic `Details` hides that the dismissal's reasons are among the store's.
			(details: DismissChangeDetails<T>) =>
				this.setOpen(false, details as unknown as Omit<Details, "preventUnmountOnClose">),
		);
		// The bag's accessors live in an object literal, where `this` is the literal.
		const event = {
			get: () => this.#openEvent,
			set: (value?: AnyPlatformEvent<T>) => (this.#openEvent = value),
		};
		const type = {
			get: () => this.#openEventType,
			set: (value?: InteractionEventType) => (this.#openEventType = value),
		};
		this.data = {
			get openEvent() {
				return event.get();
			},
			set openEvent(value) {
				event.set(value);
			},
			get openEventType() {
				return type.get();
			},
			set openEventType(value) {
				type.set(value);
			},
			insideTree: false,
			nodeId: undefined,
		};
	}

	get open(): boolean {
		return this.#open.current;
	}

	/**
	 * The open value the store last heard of. It differs from {@link open} only after a bound
	 * `open` changed from outside, until the store's watch hears of it.
	 */
	get heardOpen(): boolean {
		return this.#heardOpen;
	}

	/** Why the popup skips its transitions, as stored: also a stale `trigger-change` while closed. */
	get storedInstantType(): InstantType {
		return this.#instant;
	}

	get popupElement(): T["element"] | null {
		return this.#popupElement;
	}

	get positionerElement(): T["element"] | null {
		return this.#positionerElement;
	}

	/** The payload of the trigger that opened the popup. */
	get payload(): Payload | undefined {
		return this.#payload;
	}

	/** The reason of the last accepted open change, until the popup unmounts. */
	get openChangeReason(): string | null {
		return this.#reason;
	}

	/** How the popup was opened, while it is open. */
	get openMethod(): InteractionType | null {
		return this.#method;
	}

	/** Whether closing waits for {@link unmount} instead of unmounting on its own. */
	get preventUnmountingOnClose(): boolean {
		return this.#preventUnmount;
	}

	/**
	 * The kind's answers for its dismissal, asked whenever one is decided. The row of the
	 * behaviour table gives the press type; a kind overrides this for an answer that depends on
	 * its state.
	 */
	protected get dismissOptions(): DismissOptions {
		return { outsidePressEvent: this.#outsidePress };
	}

	/** The popup id for the trigger that owns the open popup, or for the only trigger. */
	triggerPopupId(triggerId: string | undefined): string | undefined {
		if (this.activeTrigger.isOpenedBy(triggerId)) {
			return this.popupId;
		}
		const onlyTrigger = triggerId !== undefined && this.activeTrigger.hasOnlyTrigger;
		return onlyTrigger ? this.popupId : undefined;
	}

	// 4. Intents
	setPopupElement = (element: T["element"] | null): void => {
		this.#popupElement = element;
	};

	setPositionerElement = (element: T["element"] | null): void => {
		this.#positionerElement = element;
	};

	/** Why the popup skips its transitions (`data-instant`). */
	setInstantType = (value: InstantType): void => {
		this.#instant = value;
	};

	/** Records how the popup is being opened (the trigger calls it before the open change). */
	setOpenMethod = (method: InteractionType | null): void => {
		this.#method = method;
	};

	/** Applies the owning trigger's forwarded data. */
	applyTriggerData(data: PopupTriggerData<Payload>): void {
		this.#payload = data.payload;
	}

	/**
	 * Registers a trigger element under `id`: refreshes the active trigger's element and data, or
	 * claims an open popup that has no active trigger.
	 * Returns the unregistration, which leaves a replacement registered under the same id alone.
	 */
	registerTrigger = (
		id: string,
		element: T["element"],
		data: Parameters<this["applyTriggerData"]>[0],
	): (() => void) => this.activeTrigger.register(id, element, () => this.applyTriggerData(data));

	/** While the trigger `id` owns the mounted popup, its element and data are the popup's. */
	forwardTriggerData = (
		id: string,
		element: T["element"] | null,
		data: Parameters<this["applyTriggerData"]>[0],
	): void => {
		this.activeTrigger.forward(id, element, () => this.applyTriggerData(data));
	};

	/**
	 * Opens or closes the popup: the kind's `open` or `close` hook first, then `onOpenChange` (it
	 * may cancel or call `preventUnmountOnClose()`), then the open-change event, then the commit,
	 * then the `opened` or `closed` hook. `details` are the kind's own change details; `source`,
	 * what the platform knows about the change. Returns whether the change went through.
	 */
	setOpen = (
		next: boolean,
		eventDetails: Omit<Details, "preventUnmountOnClose">,
		source: Source = {} as Source,
	): boolean => {
		if (this.#detached) {
			return false;
		}
		const details = eventDetails as Details;
		let accepted = false;
		this.#run(() => {
			const hooks = this.hooks;
			const request: PopupRequest<Details, Source> = { next, details, source };
			(next ? hooks.open : hooks.close)?.call(hooks, request);
			accepted = this.#propose(request);
			if (accepted) {
				(next ? hooks.opened : hooks.closed)?.call(hooks, this, request);
			}
		});
		return accepted;
	};

	/**
	 * For a handle: an imperative open change. `event` is the platform's event for a change with no
	 * native one; an imperative change has no event type, so it records its reason.
	 */
	openImperatively = (
		open: boolean,
		event: PlatformEvent<T, typeof REASONS.imperativeAction>,
		trigger: T["element"] | undefined,
		triggerId?: string,
	): void => {
		// A generic `Details` hides that the reason is one of the store's.
		const details = createChangeEventDetails<typeof REASONS.imperativeAction, {}, T>(
			REASONS.imperativeAction,
			event,
			trigger,
		);
		this.setOpen(
			open,
			details as unknown as Omit<Details, "preventUnmountOnClose">,
			{
				triggerId,
				eventType: REASONS.imperativeAction,
			} as Source,
		);
	};

	/**
	 * Tells the popup's interactions about an open change, after recording the event that opened the
	 * popup (see `keepsOpenEvent`). Runs before the change is committed, so listeners still read the
	 * previous state. Also called on its own, for a close the interactions must hear that changes
	 * nothing (a press that cancels a pending open).
	 */
	announce = (
		open: boolean,
		details: PopupChangeEventDetails<T>,
		source: OpenChangeSource,
	): void => {
		if (this.#detached) {
			return;
		}
		const wasOpen = untrack(() => this.open);
		// The trigger the request names, resolved the way the commit that follows resolves it.
		const triggers = this.activeTrigger;
		const triggerChanged = untrack(() =>
			namesOtherTrigger(
				triggers.idOf(details.trigger) ?? (details.trigger ? (source.triggerId ?? null) : null),
				triggers.id,
			),
		);
		if (!keepsOpenEvent(open, wasOpen, source.eventType, triggerChanged)) {
			this.#openEvent = open ? (details.event as AnyPlatformEvent<T>) : undefined;
			this.#openEventType = open ? source.eventType : undefined;
		}
		this.events.emit("openchange", {
			open,
			reason: details.reason,
			nativeEvent: details.event as AnyPlatformEvent<T>,
			nested: this.nested,
			triggerElement: details.trigger,
		});
	};

	/**
	 * Adds the popup's node to the floating tree, under `parentId`: popups nested in its Positioner
	 * are its children. Returns the removal. The Positioner's wiring calls it while it is mounted.
	 */
	joinFloatingTree = (id: string, parentId: string | null): (() => void) => {
		const tree = this.tree;
		const node: FloatingNode<T> = { id, parentId, context: this };
		tree?.addNode(node);
		this.data.nodeId = id;
		return () => tree?.removeNode(node);
	};

	/**
	 * The exit animations finished: ends the closing phase and the opening. Ignored while open or
	 * already unmounted, so calling it after the automatic unmount doesn't complete twice.
	 */
	unmount = (): void => {
		untrack(() => {
			// Called during an open change that may close: decided once it commits.
			if (this.open && this.#changing) {
				this.#pendingUnmount = true;
				return;
			}
			if (this.open || !this.presence.complete()) {
				return;
			}
			this.activeTrigger.set(null, null);
			this.#reason = null;
			this.#preventUnmount = false;
			this.hooks.unmounted?.(this);
			callUser(this.#props().onOpenChangeComplete, false);
		});
	};

	/** The enter animations finished: reports a finished opening. */
	completeOpen = (): void => {
		if (untrack(() => this.open)) {
			callUser(this.#props().onOpenChangeComplete, true);
		}
	};

	/**
	 * Runs an open change untracked. An {@link unmount} called during it (from `onOpenChange`,
	 * before the close is committed) waits for the outermost change to finish.
	 */
	#run(change: () => void): void {
		const outer = this.#changing;
		this.#changing = true;
		try {
			untrack(change);
		} finally {
			this.#changing = outer;
		}
		if (!outer && this.#pendingUnmount) {
			this.#pendingUnmount = false;
			// Unmounts only if the popup really closed; a call during a declined close is dropped.
			this.unmount();
		}
	}

	/** `onOpenChange`, the open-change event, then the commit. */
	#propose(request: PopupRequest<Details, Source>): boolean {
		const { next, details, source } = request;
		let preventUnmount = false;
		(details as PopupChangeEventDetails<T>).preventUnmountOnClose = () => {
			preventUnmount = true;
		};
		let accepted = false;
		const notify = (value: boolean, eventDetails: Details) => {
			callUser(this.#props().onOpenChange, value, eventDetails);
			if (!eventDetails.isCanceled) {
				accepted = true;
				this.announce(value, eventDetails, source);
			}
		};
		this.#open.set(next, details, notify);
		if (!accepted) {
			return false;
		}
		// An opening starts a new cycle; a close may keep the popup mounted until `unmount()`.
		if (next) {
			this.#preventUnmount = false;
		} else if (preventUnmount) {
			this.#preventUnmount = true;
		}
		this.#reason = details.reason;
		this.#hear(this.open);
		untrack(() => this.activeTrigger.commit(next, details.trigger, source.triggerId));
		return true;
	}

	/**
	 * The store hears of the open value: an accepted change at once, before the kind's `opened` or
	 * `closed` hook, and a change from outside in the watch on `open`. A new opening drops the
	 * stored instant type, so it never inherits one from an earlier opening or close; a hook that
	 * runs after sets the opening's own.
	 */
	#hear(open: boolean): void {
		if (opensUnheard(open, this.#heardOpen)) {
			this.#instant = undefined;
		}
		this.#heardOpen = open;
	}

	// 5. Lifetime work: dev warnings, transition status frames, and the bookkeeping that follows
	// open state. Called once by the Root part.
	connect(): void {
		this.#open.connect();
		this.presence.connect();

		const hover = this.hover;
		if (hover) {
			// Hover timers and the safe polygon never outlive the popup.
			$effect(() => () => hover.dispose());
		}
		// Follows `open` however it changed. A bound `open` set from outside passes no request, so
		// this is where the store hears of it: an opening starts a new close cycle and drops the
		// instant type an earlier opening or close stored (until then `heardOpen` hides it), a close
		// forgets how the popup was opened (on `open` alone: a trigger that registers while closed
		// keeps the method a press just recorded). A close the store had not heard of came from
		// outside: no open-change event told the triggers, so hover is told here.
		//
		// `heardOpen` is watched too: a request and the app can cancel each other out in one update,
		// which leaves `open` where it was (see `openValuesToFollow`).
		let followed: boolean | undefined;
		const follow = (open: boolean) => {
			const fromOutside = closesUnheard(open, this.#heardOpen);
			this.#hear(open);
			if (open) {
				this.#preventUnmount = false;
			} else {
				this.#method = null;
				if (fromOutside) {
					hover?.closedFromOutside();
				}
				hover?.resetAfterClose();
			}
			this.hooks.openChanged?.(open);
			followed = open;
		};
		watch([() => this.open, () => this.#heardOpen], ([open, heard]) => {
			for (const value of openValuesToFollow(open, heard, followed)) {
				follow(value);
			}
		});

		// The active trigger follows registrations.
		this.activeTrigger.connect();
	}
}
