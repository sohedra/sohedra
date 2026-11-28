import {
	type DismissChangeDetails,
	DismissInteraction,
	type DismissOptions,
	type OutsidePressEvent,
} from "../dismiss/index.js";
import { HoverInteraction } from "../hover/index.js";
import {
	type Bound,
	createChangeEventDetails,
	OwnedValue,
	type Platform,
	type PlatformEvent,
	type PlatformTypes,
	REASONS,
} from "../kernel/index.js";
import type { PositionerStore } from "../position/index.js";
import type { Presence, TransitionStatus } from "../presence/index.js";
import type { ActiveTriggerStore } from "./popup-active-trigger-store.svelte.js";
import type { PopupBehavior } from "./popup-behavior.js";
import type { EventEmitter } from "./popup-event-emitter.js";
import type {
	FloatingNode,
	FloatingNodeContextValue,
	FloatingTree,
} from "./popup-floating-tree.js";
import {
	PopupLifecycle,
	type PopupLifecycleProps,
	type PopupHooks,
} from "./popup-lifecycle.svelte.js";
import { visibleInstantType } from "./popup-rules.js";
import type { PopupTriggerMap } from "./popup-trigger-map.js";
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
export type PopupStoreProps<Details> = PopupLifecycleProps<Details>;

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
export interface PopupStoreKind<Extra extends object = object> {
	/** The component name in warnings, e.g. `Popover`. */
	readonly name: string;
	/** The kind's row of the behaviour table. */
	readonly behavior: PopupBehavior;
	/** The store's own extra fields of one opening, fresh for each. */
	readonly extra?: (() => Extra) | undefined;
}

/** What `PopupStore` is given: the popup's deps, and its kind, which the kind's store adds. */
export interface PopupStoreKindDeps<
	T extends PlatformTypes,
	Extra extends object,
> extends PopupStoreDeps<T> {
	/** The kind of popup: its name, its behaviour row, its extra fields. */
	readonly kind: PopupStoreKind<Extra>;
}

/**
 * What every popup's parts and interactions share: the popup and positioner elements, the node
 * in the floating tree, the triggers and the payload of the one that owns the popup, on top of
 * the {@link PopupLifecycle} that opens and closes it. A kind's store extends it once and passes
 * its {@link hooks}; it writes no `setOpen` of its own.
 *
 * Many members here only pass the lifecycle's state on under the names the unmoved popup
 * behaviours read (`open`, `mounted`, `triggers`, `data`…). They go when those behaviours take
 * the lifecycle or a small view instead of the whole store.
 */
export abstract class PopupStore<
	Payload = unknown,
	T extends PlatformTypes = PlatformTypes,
	Details extends PopupChangeEventDetails<T> = PopupChangeEventDetails<T>,
	Extra extends object = object,
	Source extends OpenChangeSource = OpenChangeSource,
> implements FloatingNodeContextValue<T> {
	// 1. Inputs
	/** The kind's hooks for the open pipeline. A field: the lifecycle reads it when a change runs. */
	protected abstract readonly hooks: PopupHooks<Details, T, Extra, Source>;

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
	/** The open state, its pipeline and the session of the current opening. */
	readonly lifecycle: PopupLifecycle<Details, T, Extra, Source>;
	/**
	 * The hover state the trigger and popup hover interactions share, for a kind whose behaviour
	 * row has `hover`; `null` for one hover never opens.
	 */
	readonly hover: HoverInteraction<T> | null;
	/**
	 * The popup's dismissal: Escape, a press on a trigger and presses outside. The platform layer
	 * calls it with what happened; {@link dismissOptions} are the kind's answers.
	 */
	readonly dismiss: DismissInteraction<T>;
	/** The mounted Positioner's measured state (for the safe polygon's side). */
	readonly positionerClaim = new OwnedValue<PositionerStore<T>>();
	/** The popup element's id: the Popup part's (it may be the user's), else `floatingId`. */
	readonly popupIdClaim = new OwnedValue<string>();
	/**
	 * Bookkeeping the interactions share and nothing renders from. The open event and its type
	 * are the session's.
	 */
	readonly data: PopupInteractionData<T>;
	/** Whether Escape and outside presses inside the popup also reach its ancestors. */
	readonly dismissBubbles = { escapeKey: false, outsidePress: true };

	readonly triggers: PopupTriggerMap<T>;
	readonly presence: Presence;
	/** Which registered trigger the popup belongs to. */
	readonly activeTrigger: ActiveTriggerStore<T>;
	/** The popup's own events: open changes, which its interactions follow. */
	readonly events: EventEmitter<PopupEvents<T>>;

	readonly #outsidePress: OutsidePressEvent;
	#popupElement: T["element"] | null = $state.raw(null);
	#positionerElement: T["element"] | null = $state.raw(null);
	#payload: Payload | undefined = $state.raw();

	// 3. Public state. `$derived.by` because the lifecycle is built in the constructor, after
	// these initialisers.
	readonly mounted: boolean = $derived.by(() => this.lifecycle.presence.mounted);
	readonly transitionStatus: TransitionStatus = $derived.by(
		() => this.lifecycle.presence.transitionStatus,
	);
	/** The id of the trigger the popup belongs to: the controlled `triggerId`, else its own. */
	readonly activeTriggerId: string | null = $derived.by(() => this.lifecycle.activeTrigger.id);
	/** The active trigger element, while the popup is mounted. */
	readonly activeTriggerElement = $derived.by(() => this.lifecycle.activeTrigger.element);
	/**
	 * The element the popup is anchored to and returns focus to: the active trigger, or the last
	 * one while unmounted.
	 */
	readonly anchorElement = $derived.by(() => this.lifecycle.activeTrigger.anchor);
	/** Why the popup skips its transitions (`data-instant`). */
	readonly instantType: InstantType = $derived.by(() =>
		visibleInstantType(this.lifecycle.session.instant, this.open, this.lifecycle.heardOpen),
	);
	/** Whether closing waits for {@link unmount} instead of unmounting on its own. */
	readonly preventUnmountingOnClose: boolean = $derived.by(
		() => this.lifecycle.session.preventUnmount,
	);
	/** Whether a closed popup is waiting for its exit animations before unmounting. */
	readonly awaitingUnmount: boolean = $derived.by(() => this.lifecycle.awaitingUnmount);
	/** The floating element: the Positioner. */
	readonly floatingElement: T["element"] | null = $derived.by(() => this.#positionerElement);
	readonly popupId: string | undefined = $derived.by(
		() => this.popupIdClaim.current ?? (this.floatingId || undefined),
	);

	/** Pure: reads no context. `props` is called inside the deriveds, so each prop stays reactive. */
	constructor(props: () => PopupStoreProps<Details>, deps: PopupStoreKindDeps<T, Extra>) {
		const { kind, platform } = deps;
		this.name = kind.name;
		this.behavior = kind.behavior;
		this.floatingId = deps.floatingId;
		this.tree = deps.tree;
		this.nested = deps.nested;
		this.platform = platform;
		this.#outsidePress = kind.behavior.outsidePress;
		this.hover = kind.behavior.hover ? new HoverInteraction<T>(platform.scheduler) : null;
		this.dismiss = new DismissInteraction<T>(
			this,
			() => this.dismissOptions,
			// A generic `Details` hides that the dismissal's reasons are among the store's.
			(details: DismissChangeDetails<T>) =>
				this.setOpen(false, details as unknown as Omit<Details, "preventUnmountOnClose">),
		);
		this.lifecycle = new PopupLifecycle<Details, T, Extra, Source>(
			props,
			deps.open,
			{
				name: kind.name,
				nested: deps.nested,
				detached: deps.detached,
				extra: kind.extra,
				hooks: () => this.hooks,
				hover: this.hover,
			},
			platform,
		);
		this.triggers = this.lifecycle.triggers;
		this.presence = this.lifecycle.presence;
		this.activeTrigger = this.lifecycle.activeTrigger;
		this.events = this.lifecycle.events;
		const session = this.lifecycle.session;
		this.data = {
			get openEvent() {
				return session.event;
			},
			set openEvent(event) {
				session.event = event;
			},
			get openEventType() {
				return session.eventType;
			},
			set openEventType(type) {
				session.eventType = type;
			},
			insideTree: false,
			nodeId: undefined,
		};
	}

	get open(): boolean {
		return this.lifecycle.open;
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
		return this.lifecycle.session.reason;
	}

	/** How the popup was opened, while it is open. */
	get openMethod(): InteractionType | null {
		return this.lifecycle.session.method;
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
	setPopupElement(element: T["element"] | null): void {
		this.#popupElement = element;
	}

	setPositionerElement(element: T["element"] | null): void {
		this.#positionerElement = element;
	}

	/** Why the popup skips its transitions (`data-instant`). */
	setInstantType(value: InstantType): void {
		this.lifecycle.session.instant = value;
	}

	/** Records how the popup is being opened (the trigger calls it before the open change). */
	setOpenMethod(method: InteractionType | null): void {
		this.lifecycle.session.method = method;
	}

	/** Applies the owning trigger's forwarded data. */
	applyTriggerData(data: PopupTriggerData<Payload>): void {
		this.#payload = data.payload;
	}

	/**
	 * Registers a trigger element under `id`: refreshes the active trigger's element and data, or
	 * claims an open popup that has no active trigger.
	 * Returns the unregistration, which leaves a replacement registered under the same id alone.
	 */
	registerTrigger(
		id: string,
		element: T["element"],
		data: Parameters<this["applyTriggerData"]>[0],
	): () => void {
		return this.activeTrigger.register(id, element, () => this.applyTriggerData(data));
	}

	/** While the trigger `id` owns the mounted popup, its element and data are the popup's. */
	forwardTriggerData(
		id: string,
		element: T["element"] | null,
		data: Parameters<this["applyTriggerData"]>[0],
	): void {
		this.activeTrigger.forward(id, element, () => this.applyTriggerData(data));
	}

	/**
	 * Opens or closes the popup through the lifecycle's pipeline: the kind's hooks, `onOpenChange`
	 * (it may cancel or call `preventUnmountOnClose()`), the open-change event, then the commit.
	 * `details` are the kind's own change details; `source`, what the platform knows about the
	 * change. Returns whether the change went through.
	 */
	setOpen = (
		next: boolean,
		details: Omit<Details, "preventUnmountOnClose">,
		source?: Source,
	): boolean => this.lifecycle.request(next, details, source);

	/**
	 * For a handle: an imperative open change. `event` is the platform's event for a change with no
	 * native one; an imperative change has no event type, so it records its reason.
	 */
	openImperatively(
		open: boolean,
		event: PlatformEvent<T, typeof REASONS.imperativeAction>,
		trigger: T["element"] | undefined,
		triggerId?: string,
	): void {
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
	}

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

	/** The exit animations finished: ends the closing phase now. */
	unmount = (): void => {
		this.lifecycle.unmount();
	};

	/** The enter animations finished: reports a finished opening. */
	completeOpen = (): void => {
		this.lifecycle.completeOpen();
	};

	// 5. Lifetime work
	/** Called once by the Root part. */
	connect(): void {
		this.lifecycle.connect();
	}
}
