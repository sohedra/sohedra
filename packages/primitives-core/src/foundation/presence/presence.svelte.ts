import { untrack } from "svelte";

import { type Scheduler, watch } from "../kernel/index.js";

/** The transition status of an element that animates in and out. */
export type TransitionStatus = "starting" | "ending" | "idle" | undefined;

export interface PresenceProps {
	/**
	 * Whether the element should be shown. An element open on the first render doesn't go through
	 * `'starting'`, so server-rendered or initially open content doesn't animate in.
	 */
	readonly open: boolean;
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
 * Mounting and transition status for an element that animates in and out. Opening mounts the
 * element with `'starting'` for one frame; closing keeps it mounted with `'ending'` until the
 * platform reports its animations finished through {@link Presence.complete}. How "finished" is
 * detected is the platform's business (the web waits on `getAnimations()`).
 */
export class Presence {
	#p: PresenceProps;
	#scheduler: Scheduler;
	// The phase the last update settled on. Written only by the commit in `connect()`, the frames
	// that settle a status and `complete()`, never while deriving.
	#committed: PresencePhase = $state.raw({ open: false, mounted: false, status: undefined });

	readonly open: boolean = $derived.by(() => this.#p.open);
	// A pure step from the committed phase to the current `open`, so `mounted` changes in the same
	// update as `open`, and a re-run with older values (an effect teardown) changes nothing.
	readonly #phase: PresencePhase = $derived(step(this.#committed, this.open));
	// Value-compared views of the phase: readers re-run when mounting or the status changes, not
	// whenever a new phase object is committed.
	readonly #mounted: boolean = $derived(this.#phase.mounted);
	readonly #status: TransitionStatus = $derived(this.#phase.status);

	constructor(props: PresenceProps, scheduler: Scheduler) {
		this.#p = props;
		this.#scheduler = scheduler;
		const open = untrack(() => props.open);
		this.#committed = { open, mounted: open, status: undefined };
	}

	/** Whether the element is rendered. */
	get mounted(): boolean {
		return this.#mounted;
	}

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
				this.#committed = { open: false, mounted: false, status: undefined };
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
		// answer; committing its result is a fixed point of the step.
		watch.pre(
			() => this.#phase,
			(phase) => {
				this.#committed = phase;
			},
			// Also on mount: `open` (or the trigger) may have moved since the constructor.
			{ lazy: false },
		);
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
				const phase = untrack(() => this.#phase);
				if (
					current &&
					phase.open === open &&
					phase.mounted === mounted &&
					phase.status === status
				) {
					this.#committed = { open, mounted, status: undefined };
				}
			});
			return () => {
				current = false;
				cancel();
			};
		});
	}
}
