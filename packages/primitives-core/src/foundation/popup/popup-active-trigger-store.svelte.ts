// Which registered trigger a popup belongs to, and the element it is anchored to.

import { untrack } from "svelte";

import { type Bound, CommittedValue, type PlatformTypes, watch } from "../kernel/index.js";
import { movesToOtherTrigger } from "./popup-rules.js";
import type { PopupTriggerMap } from "./popup-trigger-map.js";
import type { InstantType } from "./popup-types.js";

/** What the active-trigger bookkeeping reads: its popup's open state and the Root's props. */
export interface ActiveTriggerStoreProps {
	readonly open: boolean;
	readonly mounted: boolean;
	/** The controlled `triggerId` prop. */
	readonly triggerId: string | null | undefined;
	readonly defaultTriggerId: string | null | undefined;
}

/** What the active-trigger bookkeeping is given once. */
export interface ActiveTriggerStoreDeps<T extends PlatformTypes = PlatformTypes> {
	/** The popup's registered triggers. */
	readonly triggers: PopupTriggerMap<T>;
	/** The popup's stored instant type, which a move to another trigger sets. */
	readonly instant: Bound<InstantType>;
}

/**
 * How the platform waits for the animations of a move to another trigger: it calls `finish` once
 * they are done, and returns a cancel that keeps `finish` from counting.
 */
export type TriggerChangeWait = (finish: () => void) => (() => void) | void;

/**
 * Which registered trigger a popup belongs to, including the one it claims implicitly: the active
 * trigger's id and element, the element the popup is anchored to, and whether it opened without a
 * trigger. `PopupStore` owns one and decides when it changes.
 */
export class ActiveTriggerStore<T extends PlatformTypes = PlatformTypes> {
	readonly #props: () => ActiveTriggerStoreProps;
	readonly #triggers: PopupTriggerMap<T>;
	readonly #instant: Bound<InstantType>;

	#id: string | null = $state(null);
	#element: T["element"] | null = $state.raw(null);
	#openedWithoutTrigger = $state(false);
	// The last trigger element stays the popup's anchor after the popup unmounts (only element
	// values are synced); a kept-mounted Positioner clears it. Committed by `connect()` after each
	// update, never while deriving.
	readonly #lastAnchor = new CommittedValue<T["element"] | null>({ initial: null });

	/** The active trigger's id: the controlled `triggerId`, else the store's own. */
	readonly id: string | null = $derived.by(() => this.#props().triggerId ?? this.#id);

	readonly #anchor: T["element"] | null = $derived(this.element ?? this.#lastAnchor.current);

	/** Pure: `props` is called inside the deriveds and queries, so each value stays reactive. */
	constructor(props: () => ActiveTriggerStoreProps, deps: ActiveTriggerStoreDeps<T>) {
		this.#props = props;
		this.#triggers = deps.triggers;
		this.#instant = deps.instant;
		this.#id = untrack(() => props().defaultTriggerId) ?? null;
	}

	/** The active trigger element, while the popup is mounted. */
	get element(): T["element"] | null {
		return this.#props().mounted ? this.#element : null;
	}

	/** The active trigger, or the last one while unmounted. */
	get anchor(): T["element"] | null {
		return this.#anchor;
	}

	/** Whether the open popup belongs to no trigger yet but has exactly one to claim it. */
	get hasOnlyTrigger(): boolean {
		return (
			this.#props().open &&
			this.id == null &&
			!this.#openedWithoutTrigger &&
			this.#triggers.size === 1
		);
	}

	/** Whether the trigger with `triggerId` is the active one. */
	isActive(triggerId: string | undefined): boolean {
		return triggerId !== undefined && this.id === triggerId;
	}

	/** Whether the popup is open and owned by the trigger with `triggerId`. */
	isOpenedBy(triggerId: string | undefined): boolean {
		return triggerId !== undefined && this.#props().open && this.id === triggerId;
	}

	/** Whether the popup is mounted and owned by the trigger with `triggerId`. */
	isMountedBy(triggerId: string | undefined): boolean {
		return triggerId !== undefined && this.id === triggerId && this.#props().mounted;
	}

	/** The id a registered trigger element has, or `null` for any other element. */
	idOf(element: T["element"] | undefined): string | null {
		if (!element) {
			return null;
		}
		for (const [id, registered] of untrack(() => this.#triggers.entries())) {
			if (registered === element) {
				return id;
			}
		}
		return null;
	}

	/** Writes the trigger the popup belongs to. */
	set = (id: string | null, element: T["element"] | null): void => {
		this.#id = id;
		this.#element = element;
	};

	/**
	 * Registers a trigger element under `id`: refreshes the active trigger's element, or claims an
	 * open popup that has no active trigger; then `takeData` applies the trigger's data. Returns
	 * the unregistration, which leaves a replacement registered under the same id alone.
	 */
	register = (id: string, element: T["element"], takeData: () => void): (() => void) => {
		untrack(() => {
			this.#triggers.add(id, element);
			const activeId = this.id;
			if (activeId === id) {
				this.#element = element;
				if (this.#props().open) {
					takeData();
				}
			} else if (activeId == null && this.#props().open && !this.#openedWithoutTrigger) {
				this.set(id, element);
				takeData();
			}
		});
		return () => {
			if (untrack(() => this.#triggers.getById(id)) === element) {
				this.#triggers.delete(id);
			}
		};
	};

	/** While the trigger `id` owns the mounted popup, its element is the popup's (and its data). */
	forward = (id: string, element: T["element"] | null, takeData: () => void): void => {
		untrack(() => {
			if (this.isMountedBy(id)) {
				this.#element = element;
				takeData();
			}
		});
	};

	/**
	 * Commits an open change's trigger (part of the open change's commit). A trigger still
	 * registered with another store (a handle moving between roots) comes with its id.
	 */
	commit = (
		open: boolean,
		trigger: T["element"] | undefined,
		knownTriggerId: string | undefined,
	): void => {
		const triggerId = this.idOf(trigger) ?? (trigger ? (knownTriggerId ?? null) : null);
		// A closing popup keeps its trigger, so exit animations and focus return still find it.
		if (triggerId || open) {
			this.set(triggerId, trigger ?? null);
		}
		// An open request without a trigger stays unassociated; a close keeps the flag until the
		// popup is effectively closed (a controlled root may decline the close).
		if (open) {
			this.#openedWithoutTrigger = trigger == null;
		}
	};

	/** Forgets the last trigger element (a kept-mounted popup that closed). */
	forgetLastTrigger = (): void => {
		this.#lastAnchor.commit(null);
	};

	/**
	 * Lifetime work: the commit of the last trigger element, and the reconciliation of the active
	 * trigger with the registered ones, in an effect because registrations happen in attachments and
	 * the open state and `triggerId` may be controlled. Each run while closed clears the no-trigger flag.
	 */
	connect(): void {
		// The last trigger element seen while mounted: the anchor, which reads the element first, so
		// when this commit runs doesn't change the answer.
		this.#lastAnchor.follow(() => this.#anchor);
		// Keeps the active trigger in step with the registered ones while the popup is open.
		$effect(() => {
			const open = this.#props().open;
			const activeId = this.id;
			const activeElement = this.#element;
			const triggerCount = this.#triggers.size;
			untrack(() => {
				if (!open) {
					this.#openedWithoutTrigger = false;
					return;
				}
				if (activeId) {
					const registered = this.#triggers.getById(activeId);
					if (registered) {
						if (registered !== activeElement) {
							this.#element = registered;
						}
						return;
					}
					// The active element may be registered under another id (its own element id).
					const id = this.idOf(activeElement ?? undefined);
					if (id) {
						this.#id = id;
					}
					return;
				}
				if (!this.#openedWithoutTrigger && triggerCount === 1) {
					const first = this.#triggers.entries().next();
					if (!first.done) {
						this.set(...first.value);
					}
				}
			});
		});
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
		const instant = this.#instant;
		// The last trigger the popup was anchored to. Not the watched previous value: an anchor
		// cleared while closed keeps it, so the next opening still compares against it.
		let lastTrigger: T["element"] | null = null;
		let cancelPending: (() => void) | void = undefined;

		// Closing drops a pending or applied trigger-change.
		watch(
			() => this.#props().open,
			(open) => {
				if (open) {
					return;
				}
				cancelPending?.();
				cancelPending = undefined;
				if (instant.value === "trigger-change") {
					instant.value = undefined;
				}
			},
		);

		// A new trigger while open: lets the transitions run, then marks the popup instant.
		watch(
			() => this.anchor,
			(current) => {
				const previous = lastTrigger;
				if (current) {
					lastTrigger = current;
				}
				if (!movesToOtherTrigger(previous, current, this.#props().open)) {
					return;
				}
				instant.value = undefined;
				let canceled = false;
				const cancelWait = waitForMove(() => {
					if (!canceled && this.#props().open) {
						instant.value = "trigger-change";
					}
				});
				const cancel = () => {
					canceled = true;
					cancelWait?.();
				};
				cancelPending = cancel;
				return cancel;
			},
		);
	}
}
