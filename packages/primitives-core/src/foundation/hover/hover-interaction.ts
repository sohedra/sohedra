// One popup's hover state, shared by its triggers and its popup element: the pointer type, the
// delay and rest timers, and the active safe-polygon tracker.

import { type PlatformTypes, type PointerType, type Scheduler, Timeout } from "../kernel/index.js";
import type { HoverEvent } from "./hover-types.js";

/** A platform listener tracking the safe polygon (web: a document `mousemove`), and its removal. */
export interface CloseTracker<T extends PlatformTypes = PlatformTypes> {
	readonly handler: (event: HoverEvent<T>) => void;
	stop(): void;
}

/** What a popup's hover state is given once. */
export interface HoverInteractionDeps {
	/** The platform's clock and frames. */
	readonly scheduler: Scheduler;
}

/**
 * One popup's hover state, shared by its triggers and its popup element: the pointer type, the
 * delay and rest timers, and the active safe-polygon tracker. A popup store builds one when its
 * kind opens on hover, and is the one that stops it.
 */
export class HoverInteraction<T extends PlatformTypes = PlatformTypes> {
	// Read when input arrives and never rendered, so not reactive.
	#pointerType: PointerType | undefined = undefined;
	#interactedInside = false;
	#blockMouseMove = true;
	#restTimeoutPending = false;
	/** The pending delayed open or close. */
	readonly openChangeTimeout: Timeout;
	/** The pending open once the pointer has rested on a trigger. */
	readonly restTimeout: Timeout;
	#tracker: CloseTracker<T> | undefined;

	constructor(deps: HoverInteractionDeps) {
		this.openChangeTimeout = new Timeout(deps.scheduler);
		this.restTimeout = new Timeout(deps.scheduler);
	}

	/** The pointer that entered or pressed a trigger last. */
	get pointerType(): PointerType | undefined {
		return this.#pointerType;
	}

	/** Whether a press inside the popup landed on an element that opens another popup. */
	get interactedInside(): boolean {
		return this.#interactedInside;
	}

	/** Whether a pointer move over a trigger is ignored: until the pointer has entered one. */
	get blockMouseMove(): boolean {
		return this.#blockMouseMove;
	}

	/** Whether a rest on a trigger is being timed. */
	get restTimeoutPending(): boolean {
		return this.#restTimeoutPending;
	}

	/** The active safe polygon's move handler. */
	get handler(): ((event: HoverEvent<T>) => void) | undefined {
		return this.#tracker?.handler;
	}

	/** A pointer entered or pressed a trigger. */
	setPointerType = (type: PointerType | undefined): void => {
		this.#pointerType = type;
	};

	/** A press inside the popup: whether it landed on an element that opens another popup. */
	setInteractedInside = (value: boolean): void => {
		this.#interactedInside = value;
	};

	/** Whether pointer moves over a trigger are ignored from now on. */
	setMouseMoveBlocked = (value: boolean): void => {
		this.#blockMouseMove = value;
	};

	/** Whether a rest on a trigger is being timed from now on. */
	setRestTimeoutPending = (value: boolean): void => {
		this.#restTimeoutPending = value;
	};

	/** Replaces the active safe-polygon tracker. */
	setCloseTracker = (tracker: CloseTracker<T>): void => {
		this.clearCloseTracker();
		this.#tracker = tracker;
	};

	/** Stops the active safe polygon: removes its listener and drops its pending close. */
	clearCloseTracker = (): void => {
		const tracker = this.#tracker;
		this.#tracker = undefined;
		tracker?.stop();
	};

	/** Drops a pending open: the delayed one and the one waiting for the pointer to rest. */
	cancelPendingOpen = (): void => {
		this.openChangeTimeout.clear();
		this.restTimeout.clear();
		this.#restTimeoutPending = false;
	};

	/** Drops everything still pending: a delayed open or close, a rest open and the safe polygon. */
	cancelPending = (): void => {
		this.clearCloseTracker();
		this.cancelPendingOpen();
	};

	/**
	 * The app closed the popup itself, so no open-change event told the triggers. Does what each
	 * does on a close: drops what is pending and ignores pointer moves over a trigger until the
	 * pointer enters one again, so the popup stays closed under a resting pointer.
	 */
	closedFromOutside = (): void => {
		this.cancelPending();
		this.#blockMouseMove = true;
	};

	/** Forgets the pointer and the inside press once the popup closes. */
	resetAfterClose = (): void => {
		this.#pointerType = undefined;
		this.#restTimeoutPending = false;
		this.#interactedInside = false;
	};

	/** Clears every timer and the safe polygon (the popup, a trigger or the Root went away). */
	stop = (): void => {
		this.openChangeTimeout.clear();
		this.restTimeout.clear();
		this.clearCloseTracker();
	};
}
