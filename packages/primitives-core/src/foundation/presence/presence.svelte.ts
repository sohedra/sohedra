import { untrack } from "svelte";

import { CommittedValue, type Scheduler } from "../kernel/index.js";

/** The transition status of an element that animates in and out. */
export type TransitionStatus = "starting" | "ending" | "idle" | undefined;

export interface PresenceProps {
	/**
	 * Whether the element should be shown. An element open on the first render doesn't go through
	 * `'starting'`, so server-rendered or initially open content doesn't animate in.
	 */
	readonly open: boolean;
}

/** What a presence is given once. */
export interface PresenceDeps {
	/** The platform's clock and frames: the status settles one frame after it changes. */
	readonly scheduler: Scheduler;
}

/** Where a presence stands: the `open` it reflects, whether it renders and its status. */
export interface PresencePhase {
	readonly open: boolean;
	readonly mounted: boolean;
	readonly status: TransitionStatus;
}

/**
 * The phase an element moves to when `open` changes from the committed phase's: opening mounts it
 * with `'starting'`, closing keeps it mounted with `'ending'`. Pure: it returns `committed` itself
 * while `open` hasn't changed, so a commit of its result is a fixed point.
 */
export function step(committed: PresencePhase, open: boolean): PresencePhase {
	if (open === committed.open) {
		return committed;
	}
	if (open) {
		if (!committed.mounted) {
			return { open, mounted: true, status: "starting" };
		}
		// Reopening while still mounted keeps the status; the frame in `connect()` clears it.
		return { open, mounted: true, status: committed.status };
	}
	if (committed.mounted) {
		return {
			open,
			mounted: true,
			status: "ending",
		};
	}
	return {
		open,
		mounted: false,
		status: committed.status === "ending" ? undefined : committed.status,
	};
}

/**
 * Mounting and transition status for an element that animates in and out: opening mounts it
 * `'starting'` for one frame; closing keeps it `'ending'` until the platform calls
 * {@link Presence.complete} (the web waits on `getAnimations()`).
 */
export class Presence {
	readonly #props: () => PresenceProps;
	readonly #scheduler: Scheduler;
	// The phase the last update settled on. Written only by the commit in `connect()`, the frames
	// that settle a status and `complete()`, never while deriving.
	readonly #committed: CommittedValue<PresencePhase>;

	/** Whether the element should be shown, from the props. */
	readonly open: boolean = $derived.by(() => this.#props().open);
	// A pure step from the committed phase to the current `open`, so `mounted` changes in the same
	// update as `open`, and a re-run with older values (an effect teardown) changes nothing.
	// `$derived.by` because `#committed` is set in the constructor, after these initialisers.
	readonly #phase: PresencePhase = $derived.by(() => step(this.#committed.current, this.open));
	// Value-compared views of the phase: readers re-run when mounting or the status changes, not
	// whenever a new phase object is committed.
	readonly #mounted: boolean = $derived(this.#phase.mounted);
	readonly #status: TransitionStatus = $derived(this.#phase.status);

	/** Pure: `props` is called inside the deriveds, so `open` stays reactive. */
	constructor(props: () => PresenceProps, deps: PresenceDeps) {
		this.#props = props;
		this.#scheduler = deps.scheduler;
		const open = props().open;
		this.#committed = new CommittedValue<PresencePhase>({
			initial: { open, mounted: open, status: undefined },
		});
	}

	/** Whether the element is rendered. */
	get mounted(): boolean {
		return this.#mounted;
	}

	/** Where the enter or exit transition is. */
	get transitionStatus(): TransitionStatus {
		return this.#status;
	}

	/**
	 * The exit animations finished: unmount, unless the element was reopened meanwhile. Returns
	 * whether it unmounted.
	 */
	complete = (): boolean =>
		untrack(() => {
			if (!this.open && this.#phase.mounted) {
				this.#committed.commit({ open: false, mounted: false, status: undefined });
				return true;
			}
			return false;
		});

	/**
	 * Commits each update's phase, and settles the status one frame after it changes: clears
	 * `'starting'` (or a stale `'ending'` after a reopen). Call once during component init (it
	 * creates effects).
	 */
	connect(): void {
		// The step reads committed state and the current `open`, so when this runs doesn't change the
		// answer; committing its result is a fixed point of the step. Also on mount: `open` (or the
		// trigger) may have moved since the constructor.
		this.#committed.follow(() => this.#phase);
		// The transition status follows `open` and `mounted` through the scheduler's frames.
		$effect(() => {
			const open = this.open;
			const mounted = this.#mounted;
			const status = this.#status;
			if (!open || status === undefined) {
				return;
			}
			// Flushing synchronously here is avoided because of Firefox.
			let current = true;
			const cancel = this.#scheduler.frame(() => {
				// Settles only the phase the frame was requested for. After any other change this effect
				// re-runs (it reads all three) and decides again.
				const phase = this.#phase;
				if (
					current &&
					phase.open === open &&
					phase.mounted === mounted &&
					phase.status === status
				) {
					this.#committed.commit({ open, mounted, status: undefined });
				}
			});
			return () => {
				current = false;
				cancel();
			};
		});
	}
}
