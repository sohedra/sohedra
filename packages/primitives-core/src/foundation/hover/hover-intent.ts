// Opening and closing a popup by hovering: what one popup's triggers and its popup element
// decide together. The platform layer forwards pointer events with what it measured; every
// decision (delays, rest-only opening, re-entering during a hover close, the safe polygon,
// touch) is made here. One file, because the trigger side and the popup side work on the same
// timers and pointer state.

import {
	createChangeEventDetails,
	type InteractionEventType,
	type PlatformEvent,
	type PlatformTypes,
	type PointerType,
	REASONS,
	type Scheduler,
	Timeout,
} from "../kernel/index.js";
import type { FloatingTree, OpenChangeDetails, OpenChangeSource } from "../popup/index.js";
import type { PhysicalSide } from "../position/index.js";
import type { TransitionStatus } from "../presence/index.js";
import {
	getDelay,
	hasMovedEnough,
	type HoverDelay,
	isHoverOpenEvent,
	isMouseLikePointerType,
	isPinnedByClick,
	opensAtOnceOnEnter,
} from "./hover-rules.js";
import {
	decideSafePolygon,
	type SafePolygonDecision,
	type SafePolygonInput,
	type SafePolygonTrack,
	startSafePolygon,
} from "./hover-safe-polygon-rules.js";

/** The platform's event for a hover change (web: a `MouseEvent`). */
export type HoverEvent<T extends PlatformTypes> = PlatformEvent<T, typeof REASONS.triggerHover>;

/** The change details a hover open or close carries. */
export type HoverChangeDetails<T extends PlatformTypes> = ReturnType<
	typeof createChangeEventDetails<typeof REASONS.triggerHover, {}, T>
>;

/**
 * Everything the hover behaviour reads from a popup, and the one thing it asks of it. The names
 * are a popup store's own, so a store whose kind opens on hover is handed over as it is; the
 * behaviour can reach nothing else of it.
 */
export interface HoverView<T extends PlatformTypes = PlatformTypes> {
	readonly open: boolean;
	/** `ending` while the popup's close transition runs. */
	readonly transitionStatus: TransitionStatus;
	/** The popup's hover state: its timers, its pointer and the active safe polygon. */
	readonly hover: HoverInteraction<T>;
	/** The tree of nested popups: an open child keeps its parent open. */
	readonly tree: FloatingTree<T> | null;
	/** Bookkeeping the popup's behaviours share. */
	readonly data: {
		/** The popup's node in {@link tree}. */
		readonly nodeId: string | undefined;
		/** The kind of event that opened the popup: a hover never closes a click-opened one. */
		readonly openEventType: InteractionEventType | undefined;
	};
	/** The element the popup is anchored to: its owning trigger. */
	readonly anchorElement: T["element"] | null;
	/** The mounted Positioner's measured state: its side is the safe polygon's. */
	readonly positionerClaim: {
		readonly current:
			| { readonly position: { readonly physicalSide: PhysicalSide } }
			| null
			| undefined;
	};
	readonly platform: { readonly scheduler: Scheduler };
	/** Opens or closes the popup. The behaviour only ever passes hover details. */
	setOpen(open: boolean, details: HoverChangeDetails<T>, source?: OpenChangeSource): void;
}

/** What the nested-popup checks read of a popup. */
type TreeView<T extends PlatformTypes> = Pick<HoverView<T>, "tree" | "data">;

/** A platform listener tracking the safe polygon (web: a document `mousemove`), and its removal. */
export interface CloseTracker<T extends PlatformTypes = PlatformTypes> {
	readonly handler: (event: HoverEvent<T>) => void;
	dispose(): void;
}

/**
 * One popup's hover state, shared by its triggers and its popup element: the pointer type, the
 * delay and rest timers, and the active safe-polygon tracker. A popup store builds one when its
 * kind opens on hover.
 */
export class HoverInteraction<T extends PlatformTypes = PlatformTypes> {
	pointerType: PointerType | undefined = undefined;
	/** Whether a press inside the popup landed on an element that opens another popup. */
	interactedInside = false;
	/** Whether a pointer move over a trigger is ignored: until the pointer has entered one. */
	blockMouseMove = true;
	/** Whether a rest on a trigger is being timed. */
	restTimeoutPending = false;
	/** The pending delayed open or close. */
	readonly openChangeTimeout: Timeout;
	/** The pending open once the pointer has rested on a trigger. */
	readonly restTimeout: Timeout;
	#tracker: CloseTracker<T> | undefined;
	#blockPointerEvents = false;
	#pointerBlock: { dispose(): void } | undefined;

	constructor(scheduler: Scheduler) {
		this.openChangeTimeout = new Timeout(scheduler);
		this.restTimeout = new Timeout(scheduler);
	}

	/**
	 * Whether the active trigger blocks pointer input outside it and the popup while hovering (a
	 * menu's trigger, so the items the pointer crosses on its way to a submenu don't react).
	 */
	get blockPointerEvents(): boolean {
		return this.#blockPointerEvents;
	}

	/** The active trigger's pointer-blocking choice (its forwarded data). */
	setBlockPointerEvents(value: boolean): void {
		this.#blockPointerEvents = value;
	}

	/**
	 * Replaces the platform's pointer block: while the pointer travels from a trigger to a nested
	 * popup (a submenu), only those two take pointer input, so the items it crosses don't react.
	 */
	setPointerBlock(block: { dispose(): void }): void {
		this.clearPointerBlock();
		this.#pointerBlock = block;
	}

	/** Lifts the pointer block. */
	clearPointerBlock(): void {
		const block = this.#pointerBlock;
		this.#pointerBlock = undefined;
		block?.dispose();
	}

	/** The active safe polygon's move handler. */
	get handler(): ((event: HoverEvent<T>) => void) | undefined {
		return this.#tracker?.handler;
	}

	/** Replaces the active safe-polygon tracker. */
	setCloseTracker(tracker: CloseTracker<T>): void {
		this.clearCloseTracker();
		this.#tracker = tracker;
	}

	/** Stops the active safe polygon: removes its listener and drops its pending close. */
	clearCloseTracker(): void {
		const tracker = this.#tracker;
		this.#tracker = undefined;
		tracker?.dispose();
	}

	/** Drops a pending open: the delayed one and the one waiting for the pointer to rest. */
	cancelPendingOpen(): void {
		this.openChangeTimeout.clear();
		this.restTimeout.clear();
		this.restTimeoutPending = false;
	}

	/** Drops everything still pending: a delayed open or close, a rest open and the safe polygon. */
	cancelPending(): void {
		this.clearCloseTracker();
		this.cancelPendingOpen();
	}

	/**
	 * The popup was closed from outside (the app set `open` to false itself), so no open-change
	 * event told the triggers. Does for them what each does on hearing of a close: drops everything
	 * still pending, and ignores pointer moves over a trigger until the pointer enters one again,
	 * so the popup stays closed while the pointer rests where it was.
	 */
	closedFromOutside(): void {
		this.cancelPending();
		this.blockMouseMove = true;
	}

	/** Forgets the pointer and the inside press once the popup closes, and lifts the block. */
	resetAfterClose(): void {
		this.pointerType = undefined;
		this.restTimeoutPending = false;
		this.interactedInside = false;
		this.clearPointerBlock();
	}

	/**
	 * Clears every timer, the safe polygon and the pointer block (the popup, a trigger or the Root
	 * unmounted).
	 */
	dispose = (): void => {
		this.openChangeTimeout.clear();
		this.restTimeout.clear();
		this.clearCloseTracker();
		this.clearPointerBlock();
	};
}

/** Whether a popup nested in this one is open. */
function hasOpenChild<T extends PlatformTypes>(popup: TreeView<T>): boolean {
	const tree = popup.tree;
	return Boolean(tree && tree.children(popup.data.nodeId).length > 0);
}

/** Whether a click holds the open popup open, which a hover never closes or reopens. */
function isPinned<T extends PlatformTypes>(popup: HoverView<T>): boolean {
	return isPinnedByClick(popup.open, popup.data.openEventType, popup.hover.interactedInside);
}

/**
 * Commits a hover open change, then lets the platform apply it (a synchronous flush on the web,
 * so running animations see the new state). An open passes its event type, so a later press
 * knows how the popup was opened.
 */
function changeOpen<T extends PlatformTypes>(
	popup: HoverView<T>,
	flush: () => void,
	open: boolean,
	event: HoverEvent<T>,
	trigger?: T["element"],
	eventType?: InteractionEventType,
	source?: object,
): void {
	popup.setOpen(
		open,
		createChangeEventDetails<typeof REASONS.triggerHover, {}, T>(
			REASONS.triggerHover,
			event,
			trigger,
		),
		{ ...source, eventType },
	);
	flush();
}

/** One hover-out's safe polygon: where it stands between two pointer moves. */
export class SafePolygon {
	#track: SafePolygonTrack;

	/** `x` and `y` are where the pointer left the trigger, `side` the popup's physical side. */
	constructor(side: PhysicalSide, x: number, y: number, now: number) {
		this.#track = startSafePolygon(side, x, y, now);
	}

	decide(input: SafePolygonInput): SafePolygonDecision {
		const next = decideSafePolygon(this.#track, input);
		this.#track = next.track;
		return next.decision;
	}
}

/** A pointer move the platform measured, for the safe polygon. */
export type SafePolygonMove = Omit<SafePolygonInput, "hasOpenChild" | "now">;

/**
 * One hover-out's safe polygon at work: each move closes, keeps open, or closes unless another
 * move comes within 40ms.
 */
export class SafePolygonSession<T extends PlatformTypes = PlatformTypes> {
	readonly #polygon: SafePolygon;
	readonly #popup: TreeView<T> & Pick<HoverView<T>, "platform">;
	readonly #onClose: () => void;
	readonly #closeSoon: Timeout;

	constructor(
		polygon: SafePolygon,
		popup: TreeView<T> & Pick<HoverView<T>, "platform">,
		onClose: () => void,
	) {
		this.#polygon = polygon;
		this.#popup = popup;
		this.#onClose = onClose;
		this.#closeSoon = new Timeout(popup.platform.scheduler);
	}

	/**
	 * A pointer move. `null` is one the platform couldn't measure (the trigger or popup is gone):
	 * it only drops a pending close-soon.
	 */
	move(input: SafePolygonMove | null): void {
		this.#closeSoon.clear();
		if (!input) {
			return;
		}
		const decision = this.#polygon.decide({
			...input,
			hasOpenChild: hasOpenChild(this.#popup),
			now: this.#popup.platform.scheduler.now(),
		});
		if (decision === "close") {
			this.#closeIfNoOpenChild();
		} else if (decision === "close-soon") {
			this.#closeSoon.start(40, () => this.#closeIfNoOpenChild());
		}
	}

	#closeIfNoOpenChild() {
		if (!hasOpenChild(this.#popup)) {
			this.#closeSoon.clear();
			this.#onClose();
		}
	}

	dispose(): void {
		this.#closeSoon.clear();
	}
}

/** A trigger's hover options. Read when a pointer event arrives, so they may change freely. */
export interface HoverTriggerOptions<T extends PlatformTypes = PlatformTypes> {
	readonly enabled: boolean;
	/** Only mouse-like pointers open on hover. */
	readonly mouseOnly: boolean;
	/** Opens once the pointer rests this long on the trigger. */
	readonly restMs: number;
	readonly delay: HoverDelay | undefined;
	/** Whether the safe polygon keeps the popup open while the pointer travels to it. */
	readonly safePolygon: boolean;
	/** Asked before each hover open; `false` vetoes it. */
	readonly shouldOpen?: (() => boolean) | undefined;
	/**
	 * What the platform measured for a hover open from `trigger`, passed with the open change
	 * besides its event type (a preview card's hovered line). Absent, an open passes only that.
	 */
	readonly openSource?:
		| ((event: HoverEvent<T>, trigger: T["element"]) => object | undefined)
		| undefined;
}

/** What the platform knows about a pointer entering or moving over a trigger. */
export interface HoverTriggerTarget<T extends PlatformTypes = PlatformTypes> {
	/** The trigger element the pointer is over. */
	readonly trigger: T["element"];
	/**
	 * The interaction, in core's vocabulary (`mouseenter`, `mousemove`), which the platform maps its
	 * native event onto; recorded when it opens the popup.
	 */
	readonly eventType: InteractionEventType | undefined;
	/** Whether it is a registered trigger other than the popup's current reference. */
	readonly overInactiveTrigger: boolean;
	/** Whether it is inside the popup's current reference element. */
	readonly withinReference: boolean;
}

/** What the platform knows about a pointer leaving a trigger. */
export interface HoverTriggerLeave<T extends PlatformTypes = PlatformTypes> {
	/** The trigger element the listener is on, if any. */
	readonly trigger: T["element"] | null;
	/**
	 * The side of the trigger the popup sits on, when the platform measured it (a popup no
	 * Positioner places); else the Positioner's side.
	 */
	readonly side?: PhysicalSide | undefined;
	/** Whether the pointer moved into another enabled trigger. */
	readonly intoEnabledTrigger: boolean;
	/** Whether the pointer moved into the popup. */
	readonly intoFloating: boolean;
	readonly clientX: number;
	readonly clientY: number;
}

/**
 * The trigger side of a popup's hover: entering, resting on and leaving one trigger opens or
 * closes the popup. `popup` is a function because a trigger attached through a handle can be
 * given another popup.
 */
export class HoverTriggerIntent<T extends PlatformTypes = PlatformTypes> {
	readonly #popup: () => HoverView<T>;
	readonly #options: () => HoverTriggerOptions<T>;
	readonly #flush: () => void;
	/** Whether the popup's last close was a hover close this trigger heard about. */
	#hoverCloseActive = false;

	constructor(popup: () => HoverView<T>, options: () => HoverTriggerOptions<T>, flush: () => void) {
		this.#popup = popup;
		this.#options = options;
		this.#flush = flush;
	}

	#closeWithDelay(popup: HoverView<T>, event: HoverEvent<T>) {
		const shared = popup.hover;
		const closeDelay = getDelay(this.#options().delay, "close", shared.pointerType);
		const close = () => {
			changeOpen(popup, this.#flush, false, event);
			popup.tree?.events.emit("floating.closed", event);
		};
		if (closeDelay) {
			shared.openChangeTimeout.start(closeDelay, close);
		} else {
			shared.openChangeTimeout.clear();
			close();
		}
	}

	#open(
		popup: HoverView<T>,
		event: HoverEvent<T>,
		target: Omit<HoverTriggerTarget<T>, "withinReference">,
	) {
		const source = this.#options().openSource?.(event, target.trigger);
		changeOpen(popup, this.#flush, true, event, target.trigger, target.eventType, source);
	}

	#mayOpen(): boolean {
		return this.#options().shouldOpen?.() !== false;
	}

	/** The popup's open-change event: a close cancels pending delays and the safe polygon. */
	openChanged(details: OpenChangeDetails<T>): void {
		if (!this.#options().enabled) {
			return;
		}
		const shared = this.#popup().hover;
		if (details.open) {
			this.#hoverCloseActive = false;
			return;
		}
		this.#hoverCloseActive = details.reason === REASONS.triggerHover;
		shared.clearCloseTracker();
		shared.cancelPendingOpen();
		shared.blockMouseMove = true;
	}

	/** A pointer entered or was pressed on the trigger. */
	pointerType(type: PointerType): void {
		if (this.#options().enabled) {
			this.#popup().hover.pointerType = type;
		}
	}

	/** The pointer entered the trigger. */
	enter(event: HoverEvent<T>, target: HoverTriggerTarget<T>): void {
		const popup = this.#popup();
		const shared = popup.hover;
		const options = this.#options();
		shared.openChangeTimeout.clear();
		shared.blockMouseMove = false;
		if (options.mouseOnly && !isMouseLikePointerType(shared.pointerType)) {
			return;
		}
		const openDelay = getDelay(options.delay, "open", shared.pointerType);
		const isOpen = popup.open;
		const closingAfterHover =
			!isOpen && popup.transitionStatus === "ending" && this.#hoverCloseActive;
		const opens = !isOpen || target.overInactiveTrigger;

		if (
			opensAtOnceOnEnter(
				isOpen,
				closingAfterHover,
				target.overInactiveTrigger,
				target.withinReference,
			)
		) {
			if (this.#mayOpen()) {
				this.#open(popup, event, target);
			}
			return;
		}
		// With a rest-only delay, the pointer's rest on the trigger opens, not its entering.
		if (options.restMs > 0 && !openDelay) {
			return;
		}
		if (openDelay) {
			shared.openChangeTimeout.start(openDelay, () => {
				if (opens && this.#mayOpen()) {
					this.#open(popup, event, target);
				}
			});
		} else if (opens && this.#mayOpen()) {
			this.#open(popup, event, target);
		}
	}

	/**
	 * The pointer left the trigger's subtree: a backup for a leave the platform dropped during a
	 * fast sweep, which cancels the pending open.
	 */
	pointerOut(): void {
		this.#popup().hover.cancelPendingOpen();
	}

	/**
	 * The pointer moved over the trigger by `movementX`/`movementY`: opens once it rests for
	 * `restMs`.
	 */
	move(
		event: HoverEvent<T>,
		target: Omit<HoverTriggerTarget<T>, "withinReference">,
		movementX: number,
		movementY: number,
	): void {
		const options = this.#options();
		if (!options.enabled) {
			return;
		}
		const popup = this.#popup();
		const shared = popup.hover;
		const isOverInactive = target.overInactiveTrigger;
		const currentOpen = popup.open;
		if (options.mouseOnly && !isMouseLikePointerType(shared.pointerType)) {
			return;
		}
		if ((currentOpen && !isOverInactive) || options.restMs === 0) {
			return;
		}
		// A move that may not open (over a nested tooltip trigger) doesn't arm the rest timer: a
		// timer armed then would open later, even after the popup was opened another way.
		if (!this.#mayOpen()) {
			return;
		}
		if (!isOverInactive && shared.restTimeoutPending && !hasMovedEnough(movementX, movementY)) {
			return;
		}
		shared.restTimeout.clear();
		const openAfterRest = () => {
			shared.restTimeoutPending = false;
			// A pending hover open doesn't override a click-like open made meanwhile.
			if (isPinned(popup)) {
				return;
			}
			if (!shared.blockMouseMove && (!popup.open || isOverInactive) && this.#mayOpen()) {
				this.#open(popup, event, target);
			}
		};
		if (shared.pointerType === "touch" || (isOverInactive && currentOpen)) {
			openAfterRest();
		} else {
			shared.restTimeoutPending = true;
			shared.restTimeout.start(options.restMs, openAfterRest);
		}
	}

	/**
	 * The pointer left the trigger. Returns a safe-polygon session when the popup should stay open
	 * while the pointer travels to it: the platform then forwards its pointer moves to the session
	 * (with this leave first) and registers the listener with `HoverInteraction.setCloseTracker`.
	 */
	leave(event: HoverEvent<T>, leave: HoverTriggerLeave<T>): SafePolygonSession<T> | undefined {
		const popup = this.#popup();
		const shared = popup.hover;
		if (isPinned(popup)) {
			shared.clearPointerBlock();
			return undefined;
		}
		shared.clearCloseTracker();
		shared.restTimeout.clear();
		shared.restTimeoutPending = false;
		if (leave.intoEnabledTrigger) {
			return undefined;
		}
		const side = this.#options().safePolygon
			? (leave.side ?? popup.positionerClaim.current?.position.physicalSide)
			: undefined;
		if (side) {
			const polygon = new SafePolygon(
				side,
				leave.clientX,
				leave.clientY,
				popup.platform.scheduler.now(),
			);
			const session = new SafePolygonSession(polygon, popup, () => {
				shared.clearPointerBlock();
				shared.clearCloseTracker();
				if (this.#options().enabled && !isPinned(popup) && leave.trigger === popup.anchorElement) {
					this.#closeWithDelay(popup, event);
				}
			});
			if (!popup.open) {
				shared.openChangeTimeout.clear();
			}
			return session;
		}
		// A touch pointer that moved into the popup keeps it open.
		if (shared.pointerType !== "touch" || !leave.intoFloating) {
			this.#closeWithDelay(popup, event);
		}
		return undefined;
	}
}

/** The popup element's hover options. Read when a pointer event arrives. */
export interface HoverPopupOptions {
	readonly enabled: boolean;
	readonly closeDelay: number;
}

/**
 * The popup side of a popup's hover: keeps a hover-opened popup open while hovered and closes it
 * when the pointer leaves, unless it moved into a trigger, a nested popup or the safe polygon,
 * or the popup was opened by a click.
 */
export class HoverPopupIntent<T extends PlatformTypes = PlatformTypes> {
	readonly #popup: HoverView<T>;
	readonly #options: () => HoverPopupOptions;
	readonly #flush: () => void;
	readonly #childClosedTimeout: Timeout;

	constructor(popup: HoverView<T>, options: () => HoverPopupOptions, flush: () => void) {
		this.#popup = popup;
		this.#options = options;
		this.#flush = flush;
		this.#childClosedTimeout = new Timeout(popup.platform.scheduler);
	}

	// Closes once the last open child closed, unless the pointer came back meanwhile.
	readonly #onNodeClosed = (event: HoverEvent<T>) => {
		const popup = this.#popup;
		const tree = popup.tree;
		if (!tree || hasOpenChild(popup)) {
			return;
		}
		// Let the pointer's entering fire first, in case the child closed because it moved here.
		this.#childClosedTimeout.start(0, () => {
			tree.events.off("floating.closed", this.#onNodeClosed);
			changeOpen(popup, this.#flush, false, event);
			tree.events.emit("floating.closed", event);
		});
	};

	/** A press inside the popup: on an interactive element, `opensPopup` if it opens another one. */
	pressInside(interactive: boolean, opensPopup: boolean): void {
		this.#popup.hover.interactedInside = interactive && opensPopup;
	}

	/** The pointer entered the popup: the pointer block it travelled through lifts. */
	enter(): void {
		this.#popup.hover.clearPointerBlock();
		this.#popup.hover.openChangeTimeout.clear();
		this.#childClosedTimeout.clear();
		this.#popup.tree?.events.off("floating.closed", this.#onNodeClosed);
	}

	/**
	 * The pointer left the popup, into another enabled trigger, into a nested popup, or elsewhere.
	 */
	leave(event: HoverEvent<T>, into: { enabledTrigger: boolean; descendant: boolean }): void {
		const popup = this.#popup;
		const shared = popup.hover;
		const tree = popup.tree;
		if (hasOpenChild(popup) && tree) {
			tree.events.on("floating.closed", this.#onNodeClosed);
			return;
		}
		if (into.enabledTrigger || into.descendant) {
			return;
		}
		// An active safe polygon decides.
		const handler = shared.handler;
		if (handler) {
			handler(event);
			return;
		}
		shared.clearPointerBlock();
		// Only an open popup closes when the pointer leaves it: the recorded open event outlives a
		// close the app makes itself, and that popup has nothing left to close.
		if (popup.open && isHoverOpenEvent(popup.data.openEventType) && !isPinned(popup)) {
			const closeDelay = getDelay(this.#options().closeDelay, "close", shared.pointerType);
			const close = () => {
				changeOpen(popup, this.#flush, false, event);
				tree?.events.emit("floating.closed", event);
			};
			if (closeDelay) {
				shared.openChangeTimeout.start(closeDelay, close);
			} else {
				shared.openChangeTimeout.clear();
				close();
			}
		}
	}

	/** The popup's listeners went away: drops the pending child-closed check. */
	dispose(): void {
		this.#popup.tree?.events.off("floating.closed", this.#onNodeClosed);
		this.#childClosedTimeout.clear();
	}
}
