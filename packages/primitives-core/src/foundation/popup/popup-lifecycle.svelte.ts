import { untrack } from "svelte";

import {
	type AnyPlatformEvent,
	type Bound,
	callUser,
	Controllable,
	type Platform,
	type PlatformTypes,
	watch,
} from "../kernel/index.js";
import { Presence } from "../presence/index.js";
import { ActiveTriggerStore } from "./popup-active-trigger-store.svelte.js";
import { EventEmitter } from "./popup-event-emitter.js";
import { OpenSession } from "./popup-open-session.svelte.js";
import {
	awaitsUnmount,
	closesUnheard,
	keepsOpenEvent,
	movesToOtherTrigger,
	namesOtherTrigger,
	opensUnheard,
	openValuesToFollow,
} from "./popup-rules.js";
import { PopupTriggerMap } from "./popup-trigger-map.js";
import type { OpenChangeSource, PopupChangeEventDetails, PopupEvents } from "./popup-types.js";

/** The popup Root props a lifecycle reads. The `open` binding comes separately, as a `Bound`. */
export interface PopupLifecycleProps<Details> {
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
 * writing its own `setOpen`; every rule is optional.
 */
export interface PopupHooks<
	Details,
	T extends PlatformTypes = PlatformTypes,
	Extra extends object = object,
	Source extends OpenChangeSource = OpenChangeSource,
> {
	/** Before an opening, which it may adjust (its details). */
	open?(request: PopupRequest<Details, Source>): void;
	/** Before a close, which it may adjust (its details). */
	close?(request: PopupRequest<Details, Source>): void;
	/** After an accepted opening. */
	opened?(session: OpenSession<T, Extra>, request: PopupRequest<Details, Source>): void;
	/** After an accepted close. */
	closed?(session: OpenSession<T, Extra>, request: PopupRequest<Details, Source>): void;
	/**
	 * `open` turned true or false, by a request or from outside (a bound `open`). Runs in an
	 * effect, after the update.
	 */
	openChanged?(open: boolean): void;
	/** The popup unmounted: the session's `extra` are fresh again. */
	unmounted?(session: OpenSession<T, Extra>): void;
}

/**
 * How the platform waits for the animations of a move to another trigger: it calls `finish` once
 * they are done, and returns a cancel that keeps `finish` from counting.
 */
export type TriggerChangeWait = (finish: () => void) => (() => void) | void;

export interface PopupLifecycleOptions<
	Details,
	T extends PlatformTypes = PlatformTypes,
	Extra extends object = object,
	Source extends OpenChangeSource = OpenChangeSource,
> {
	/** The component name in warnings, e.g. `Popover`. */
	readonly name: string;
	/** Whether the popup is nested in another floating element: told to open-change listeners. */
	readonly nested: boolean;
	/** An inert lifecycle for a handle without a Root: it never opens. */
	readonly detached?: boolean | undefined;
	/** The store's own extra fields of one opening, fresh for each. */
	readonly extra?: (() => Extra) | undefined;
	/** The store's hooks. A function: they are read when a change runs, not at construction. */
	readonly hooks: () => PopupHooks<Details, T, Extra, Source>;
	/** The popup's hover state, when its kind opens on hover. */
	readonly hover?:
		| { closedFromOutside(): void; resetAfterClose(): void; dispose(): void }
		| null
		| undefined;
}

/**
 * A popup's open state and the one pipeline that changes it: `onOpenChange` first (it may cancel or
 * call `preventUnmountOnClose()`), then the open-change event, then the commit. It owns the open
 * value, the presence, the registered and active triggers and the session record of the opening.
 *
 * The platform reports both ends of the presence: {@link completeOpen} once the enter animations
 * finished, {@link unmount} once the exit animations did.
 */
export class PopupLifecycle<
	Details extends PopupChangeEventDetails<T>,
	T extends PlatformTypes = PlatformTypes,
	Extra extends object = object,
	Source extends OpenChangeSource = OpenChangeSource,
> {
	// 1. Inputs
	readonly #props: () => PopupLifecycleProps<Details>;
	readonly #options: PopupLifecycleOptions<Details, T, Extra, Source>;

	// 2. Owned objects
	readonly #open: Controllable<boolean>;
	readonly presence: Presence;
	readonly triggers = new PopupTriggerMap<T>();
	/** Which registered trigger the popup belongs to. */
	readonly activeTrigger: ActiveTriggerStore<T>;
	/** The popup's own events: open changes, which its interactions follow. */
	readonly events = new EventEmitter<PopupEvents<T>>();
	/** The record of the current opening. */
	readonly session: OpenSession<T, Extra>;

	// An open change is running; an unmount asked for during it waits for its commit.
	#changing = false;
	#pendingUnmount = false;
	// The open value the session last heard of: committed by an accepted change, or seen by the
	// watch on `open` after a change from outside. It lags `open` only between such a change and
	// that watch, which is when an opening must not show what an earlier one stored. A close it
	// had not heard of when the watch runs came from outside: no request passed.
	#heardOpen = $state(false);

	// 3. Public state. `$derived.by` because the owned objects are built in the constructor, after
	// these initialisers.
	/** Whether a closed popup is waiting for its exit animations before unmounting. */
	readonly awaitingUnmount: boolean = $derived.by(() =>
		awaitsUnmount(this.open, this.presence.mounted, this.session.preventUnmount),
	);

	constructor(
		props: () => PopupLifecycleProps<Details>,
		open: Bound<boolean | undefined>,
		options: PopupLifecycleOptions<Details, T, Extra, Source>,
		platform: Platform<T>,
	) {
		this.#props = props;
		this.#options = options;
		this.#open = new Controllable<boolean>(open, {
			default: () => props().defaultOpen ?? false,
			name: options.name,
			state: "open",
		});
		this.session = new OpenSession<T, Extra>(options.extra ?? (() => ({}) as Extra));
		this.#heardOpen = untrack(() => this.#open.current);
		// The view's getters live in an object literal, where `this` is the literal.
		const isOpen = () => this.open;
		const isMounted = () => this.presence.mounted;
		const view = {
			get open() {
				return isOpen();
			},
			get mounted() {
				return isMounted();
			},
			get triggerId() {
				return props().triggerId;
			},
			get defaultTriggerId() {
				return props().defaultTriggerId;
			},
		};
		this.presence = new Presence(view, platform.scheduler);
		this.activeTrigger = new ActiveTriggerStore<T>(() => view, { triggers: this.triggers });
	}

	get open(): boolean {
		return this.#open.current;
	}

	/**
	 * The open value the session last heard of. It differs from {@link open} only after a bound
	 * `open` changed from outside, until the lifecycle's watch hears of it.
	 */
	get heardOpen(): boolean {
		return this.#heardOpen;
	}

	/** Whether this is the inert lifecycle of a handle without a Root. */
	get detached(): boolean {
		return this.#options.detached ?? false;
	}

	// 4. Intents
	/**
	 * Asks to open or close: the kind's `open` or `close` hook first, then `onOpenChange` (it may
	 * cancel), then the open-change event, then the commit, then the `opened` or `closed` hook.
	 * Returns whether the change went through.
	 */
	request(
		next: boolean,
		eventDetails: Omit<Details, "preventUnmountOnClose">,
		source: Source = {} as Source,
	): boolean {
		if (this.detached) {
			return false;
		}
		const details = eventDetails as Details;
		let accepted = false;
		this.#run(() => {
			const hooks = this.#options.hooks();
			const request: PopupRequest<Details, Source> = { next, details, source };
			(next ? hooks.open : hooks.close)?.call(hooks, request);
			accepted = this.#propose(request);
			if (accepted) {
				(next ? hooks.opened : hooks.closed)?.call(hooks, this.session, request);
			}
		});
		return accepted;
	}

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
		const session = this.session;
		if (next) {
			session.preventUnmount = false;
		} else if (preventUnmount) {
			session.preventUnmount = true;
		}
		session.reason = details.reason;
		this.#hear(this.open);
		untrack(() => this.activeTrigger.commit(next, details.trigger, source.triggerId));
		return true;
	}

	/**
	 * The session hears of the open value: an accepted change at once, before the kind's `opened`
	 * or `closed` hook, and a change from outside in the watch on `open`. A new opening drops the
	 * stored instant type, so it never inherits one from an earlier opening or close; a hook that
	 * runs after sets the opening's own.
	 */
	#hear(open: boolean): void {
		if (opensUnheard(open, this.#heardOpen)) {
			this.session.instant = undefined;
		}
		this.#heardOpen = open;
	}

	/**
	 * Tells the popup's interactions about an open change, after recording the event that opened the
	 * popup (see `keepsOpenEvent`). Runs before the change is committed, so listeners still read the
	 * previous state. Also called on its own, for a close the interactions must hear that changes
	 * nothing (a press that cancels a pending open).
	 */
	announce(open: boolean, details: PopupChangeEventDetails<T>, source: OpenChangeSource): void {
		if (this.detached) {
			return;
		}
		const session = this.session;
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
			session.event = open ? (details.event as AnyPlatformEvent<T>) : undefined;
			session.eventType = open ? source.eventType : undefined;
		}
		this.events.emit("openchange", {
			open,
			reason: details.reason,
			nativeEvent: details.event as AnyPlatformEvent<T>,
			nested: this.#options.nested,
			triggerElement: details.trigger,
		});
	}

	/**
	 * The exit animations finished: ends the closing phase and the session. Ignored while open or
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
			this.session.end();
			this.#options.hooks().unmounted?.(this.session);
			callUser(this.#props().onOpenChangeComplete, false);
		});
	};

	/** The enter animations finished: reports a finished opening. */
	completeOpen = (): void => {
		if (untrack(() => this.open)) {
			callUser(this.#props().onOpenChangeComplete, true);
		}
	};

	// 5. Lifetime work: dev warnings, transition status frames, and the bookkeeping that follows
	// open state. Called once by the store's `connect()`.
	connect(): void {
		this.#open.connect();
		this.presence.connect();

		const hover = this.#options.hover;
		if (hover) {
			// Hover timers and the safe polygon never outlive the popup.
			$effect(() => () => hover.dispose());
		}
		// Follows `open` however it changed. A bound `open` set from outside passes no request, so
		// this is where the session hears of it: an opening starts a new close cycle and drops the
		// instant type an earlier opening or close stored (until then `heardOpen` hides it), a close
		// forgets how the popup was opened, the pointer and the inside press (on `open` alone: a
		// trigger that registers while closed keeps the method a press just recorded). A close the
		// session had not heard of came from outside: no open-change event told the triggers, so
		// hover is told here.
		//
		// `heardOpen` is watched too: a request and the app can cancel each other out in one update,
		// which leaves `open` where it was (see `openValuesToFollow`).
		let followed: boolean | undefined;
		const follow = (open: boolean) => {
			const fromOutside = closesUnheard(open, this.#heardOpen);
			this.#hear(open);
			if (open) {
				this.session.preventUnmount = false;
			} else {
				this.session.close();
				if (fromOutside) {
					hover?.closedFromOutside();
				}
				hover?.resetAfterClose();
			}
			this.#options.hooks().openChanged?.(open);
			followed = open;
		};
		watch(
			[() => this.open, () => this.#heardOpen],
			([open, heard]) => {
				for (const value of openValuesToFollow(open, heard, followed)) {
					follow(value);
				}
			},
			{ lazy: false },
		);

		// The active trigger follows registrations.
		this.activeTrigger.connect();
	}

	/**
	 * Decides when the popup moved to another trigger: when the active trigger changes while the
	 * popup is open, its transitions run once more (it repositions), so the instant type is cleared
	 * and `waitForMove` is called; once the platform calls the `finish` it was given, the instant
	 * type is `trigger-change` while the popup stays with that trigger. Closing drops a pending or
	 * applied `trigger-change`. `waitForMove` returns a cancel, called when the move is superseded,
	 * the popup closes, or the caller goes away.
	 *
	 * Call once during the init of the part that animates the move (the Positioner): what it
	 * remembers lives as long as that part.
	 */
	connectTriggerChange(waitForMove: TriggerChangeWait): void {
		const session = this.session;
		// The last trigger the popup was anchored to. Not the watched previous value: a reference
		// cleared while closed keeps it, so the next opening still compares against it.
		let lastTrigger: T["element"] | null = null;
		let cancelPending: (() => void) | void = undefined;

		// Closing drops a pending or applied trigger-change.
		watch(
			() => this.open,
			(open) => {
				if (open) {
					return;
				}
				cancelPending?.();
				cancelPending = undefined;
				if (session.instant === "trigger-change") {
					session.instant = undefined;
				}
			},
			{ lazy: false },
		);

		// A new trigger while open: lets the transitions run, then marks the popup instant.
		watch(
			() => this.activeTrigger.anchor,
			(current) => {
				const previous = lastTrigger;
				if (current) {
					lastTrigger = current;
				}
				if (!movesToOtherTrigger(previous, current, this.open)) {
					return;
				}
				session.instant = undefined;
				let canceled = false;
				const cancelWait = waitForMove(() => {
					if (!canceled && this.open) {
						session.instant = "trigger-change";
					}
				});
				const cancel = () => {
					canceled = true;
					cancelWait?.();
				};
				cancelPending = cancel;
				return cancel;
			},
			{ lazy: false },
		);
	}
}
