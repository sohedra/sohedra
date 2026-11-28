// The trigger side of a popup's hover: entering, resting on and leaving a trigger opens or closes
// the popup. The platform forwards pointer events with what it measured; every decision is made
// here and in the popup side, on the timers and pointer state of the popup's `HoverInteraction`.

import {
	createChangeEventDetails,
	type InteractionEventType,
	type PlatformTypes,
	type PointerType,
	REASONS,
} from "../kernel/index.js";
import type { OpenChangeDetails, PopupView } from "../popup/index.js";
import {
	getDelay,
	hasMovedEnough,
	type HoverDelay,
	isMouseLikePointerType,
	isPinned,
	opensAtOnceOnEnter,
} from "./hover-rules.js";
import { SafePolygonSession } from "./hover-safe-polygon-session.js";
import { SafePolygon } from "./hover-safe-polygon.js";
import type { HoverEvent } from "./hover-types.js";

/**
 * Commits a hover open change, then lets the platform apply it (a synchronous flush on the web,
 * so running animations see the new state). An open passes its event type, so a later press
 * knows how the popup was opened.
 */
export function changeOpen<T extends PlatformTypes>(
	popup: PopupView<T>,
	flush: () => void,
	open: boolean,
	event: HoverEvent<T>,
	trigger?: T["element"],
	eventType?: InteractionEventType,
): void {
	popup.setOpen(
		open,
		createChangeEventDetails<typeof REASONS.triggerHover, {}, T>(
			REASONS.triggerHover,
			event,
			trigger,
		),
		{ eventType },
	);
	flush();
}

/** A trigger's hover props. Read when a pointer event arrives, so they may change freely. */
export interface HoverTriggerStoreProps {
	readonly enabled: boolean;
	/** Only mouse-like pointers open on hover. */
	readonly mouseOnly: boolean;
	/** Opens once the pointer rests this long on the trigger. */
	readonly restMs: number;
	readonly delay: HoverDelay | undefined;
	/** Whether the safe polygon keeps the popup open while the pointer travels to it. */
	readonly safePolygon: boolean;
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
	/** Whether it is a registered trigger other than the popup's current anchor. */
	readonly overInactiveTrigger: boolean;
	/** Whether it is inside the popup's current anchor element. */
	readonly withinAnchor: boolean;
}

/** What the platform knows about a pointer leaving a trigger. */
export interface HoverTriggerLeave<T extends PlatformTypes = PlatformTypes> {
	/** The trigger element the listener is on, if any. */
	readonly trigger: T["element"] | null;
	/** Whether the pointer moved into another enabled trigger. */
	readonly intoEnabledTrigger: boolean;
	/** Whether the pointer moved into the popup. */
	readonly intoPopup: boolean;
	readonly clientX: number;
	readonly clientY: number;
}

/** What a trigger's hover store is given once. */
export interface HoverTriggerStoreDeps<T extends PlatformTypes = PlatformTypes> {
	/** The popup it opens and closes: a function, since a handle can give the trigger another. */
	readonly popup: () => PopupView<T>;
	/**
	 * Lets the platform apply a committed hover change at once (web: `flushSync`), so running
	 * animations see the new state.
	 */
	readonly flush: () => void;
}

/**
 * The trigger side of a popup's hover: entering, resting on and leaving one trigger opens or
 * closes the popup. Its `popup` is a function because a trigger attached through a handle can be
 * given another popup.
 */
export class HoverTriggerStore<T extends PlatformTypes = PlatformTypes> {
	readonly #popup: () => PopupView<T>;
	readonly #props: () => HoverTriggerStoreProps;
	readonly #flush: () => void;
	/** Whether the popup's last close was a hover close this trigger heard about. */
	#hoverCloseActive = false;

	/** `props` is read when a pointer event arrives, so they may change freely. */
	constructor(props: () => HoverTriggerStoreProps, deps: HoverTriggerStoreDeps<T>) {
		this.#popup = deps.popup;
		this.#props = props;
		this.#flush = deps.flush;
	}

	#closeWithDelay(popup: PopupView<T>, event: HoverEvent<T>) {
		const shared = popup.hover;
		const closeDelay = getDelay(this.#props().delay, "close", shared.pointerType);
		const close = () => {
			changeOpen(popup, this.#flush, false, event);
			popup.tree?.events.emit("popup.closed", event);
		};
		if (closeDelay) {
			shared.openChangeTimeout.start(closeDelay, close);
		} else {
			shared.openChangeTimeout.clear();
			close();
		}
	}

	#open(
		popup: PopupView<T>,
		event: HoverEvent<T>,
		target: Omit<HoverTriggerTarget<T>, "withinAnchor">,
	) {
		changeOpen(popup, this.#flush, true, event, target.trigger, target.eventType);
	}

	/** The popup's open-change event: a close cancels pending delays and the safe polygon. */
	openChanged = (details: OpenChangeDetails<T>): void => {
		if (!this.#props().enabled) {
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
		shared.setMouseMoveBlocked(true);
	};

	/** A pointer entered or was pressed on the trigger. */
	pointerType = (type: PointerType): void => {
		if (this.#props().enabled) {
			this.#popup().hover.setPointerType(type);
		}
	};

	/** The pointer entered the trigger. */
	enter = (event: HoverEvent<T>, target: HoverTriggerTarget<T>): void => {
		const popup = this.#popup();
		const shared = popup.hover;
		const props = this.#props();
		shared.openChangeTimeout.clear();
		shared.setMouseMoveBlocked(false);
		if (props.mouseOnly && !isMouseLikePointerType(shared.pointerType)) {
			return;
		}
		const openDelay = getDelay(props.delay, "open", shared.pointerType);
		const isOpen = popup.open;
		const closingAfterHover =
			!isOpen && popup.transitionStatus === "ending" && this.#hoverCloseActive;
		const opens = !isOpen || target.overInactiveTrigger;

		if (
			opensAtOnceOnEnter(isOpen, closingAfterHover, target.overInactiveTrigger, target.withinAnchor)
		) {
			this.#open(popup, event, target);
			return;
		}
		// With a rest-only delay, the pointer's rest on the trigger opens, not its entering.
		if (props.restMs > 0 && !openDelay) {
			return;
		}
		if (openDelay) {
			shared.openChangeTimeout.start(openDelay, () => {
				if (opens) {
					this.#open(popup, event, target);
				}
			});
		} else if (opens) {
			this.#open(popup, event, target);
		}
	};

	/**
	 * The pointer moved over the trigger by `movementX`/`movementY`: opens once it rests for
	 * `restMs`.
	 */
	move = (
		event: HoverEvent<T>,
		target: Omit<HoverTriggerTarget<T>, "withinAnchor">,
		movementX: number,
		movementY: number,
	): void => {
		const props = this.#props();
		if (!props.enabled) {
			return;
		}
		const popup = this.#popup();
		const shared = popup.hover;
		const isOverInactive = target.overInactiveTrigger;
		const currentOpen = popup.open;
		if (props.mouseOnly && !isMouseLikePointerType(shared.pointerType)) {
			return;
		}
		if ((currentOpen && !isOverInactive) || props.restMs === 0) {
			return;
		}
		if (!isOverInactive && shared.restTimeoutPending && !hasMovedEnough(movementX, movementY)) {
			return;
		}
		shared.restTimeout.clear();
		const openAfterRest = () => {
			shared.setRestTimeoutPending(false);
			// A pending hover open doesn't override a click-like open made meanwhile.
			if (isPinned(popup)) {
				return;
			}
			if (!shared.blockMouseMove && (!popup.open || isOverInactive)) {
				this.#open(popup, event, target);
			}
		};
		if (shared.pointerType === "touch" || (isOverInactive && currentOpen)) {
			openAfterRest();
		} else {
			shared.setRestTimeoutPending(true);
			shared.restTimeout.start(props.restMs, openAfterRest);
		}
	};

	/**
	 * The pointer left the trigger. Returns a safe-polygon session when the popup should stay open
	 * while the pointer travels to it: the platform then forwards its pointer moves to the session
	 * (with this leave first) and registers the listener with `HoverInteraction.setCloseTracker`.
	 */
	leave = (
		event: HoverEvent<T>,
		leave: HoverTriggerLeave<T>,
	): SafePolygonSession<T> | undefined => {
		const popup = this.#popup();
		const shared = popup.hover;
		if (isPinned(popup)) {
			return undefined;
		}
		shared.clearCloseTracker();
		shared.restTimeout.clear();
		shared.setRestTimeoutPending(false);
		if (leave.intoEnabledTrigger) {
			return undefined;
		}
		const side = this.#props().safePolygon
			? popup.positionerClaim.current?.position.physicalSide
			: undefined;
		if (side) {
			const polygon = new SafePolygon(
				side,
				leave.clientX,
				leave.clientY,
				popup.platform.scheduler.now(),
			);
			const session = new SafePolygonSession<T>({
				polygon,
				popup,
				close: () => {
					shared.clearCloseTracker();
					if (this.#props().enabled && !isPinned(popup) && leave.trigger === popup.anchorElement) {
						this.#closeWithDelay(popup, event);
					}
				},
			});
			if (!popup.open) {
				shared.openChangeTimeout.clear();
			}
			return session;
		}
		// A touch pointer that moved into the popup keeps it open.
		if (shared.pointerType !== "touch" || !leave.intoPopup) {
			this.#closeWithDelay(popup, event);
		}
		return undefined;
	};
}
