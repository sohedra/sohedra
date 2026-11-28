// Closing a popup with Escape or a press outside it. One popup's
// dismissal: the press being followed, the timers around it and the calls a platform makes with
// what happened. The platform finds out where a press landed and tells this; what the press
// means is decided here, with the plain functions of `dismiss-rules.ts`.

import {
	type ChangeEventDetails,
	createChangeEventDetails,
	type InteractionEventType,
	type PlatformEvent,
	type PlatformTypes,
	type Point,
	type PointerType,
	REASONS,
	Timeout,
} from "../kernel/index.js";
import type { PopupView } from "../popup/index.js";
import {
	hasBlockingChild,
	isIgnoredOutsidePress,
	isTrailingClick,
	LONG_TOUCH_MS,
	type OutsidePressEvent,
	pressEndOutcome,
	type PressType,
	resolvePressType,
	touchMoveOutcome,
} from "./dismiss-rules.js";

type EscapeReason = typeof REASONS.escapeKey;
type OutsidePressReason = typeof REASONS.outsidePress;

/** The change details a dismissal closes with. */
export type DismissChangeDetails<T extends PlatformTypes> = ChangeEventDetails<
	EscapeReason | OutsidePressReason,
	{},
	T
>;

/** What a kind of popup fixes about its dismissal; its store answers them live. */
export interface DismissInteractionProps {
	/** Whether Escape and outside presses dismiss at all. @default true */
	readonly enabled?: boolean | undefined;
	/** How an outside press is detected, per kind of pointer. @default 'sloppy' */
	readonly outsidePressEvent?: OutsidePressEvent | undefined;
}

/** An Escape that closed the popup: what the platform does with its event. */
export interface EscapeOutcome {
	/** Whether the event's default action is prevented: not when `onOpenChange` cancelled. */
	readonly preventDefault: boolean;
	/** Whether the event stops here, so no ancestor popup closes too. */
	readonly stopPropagation: boolean;
}

/**
 * A press outside the popup, as the platform saw it. `spared` and `pressBacked` are read only
 * when the press would otherwise dismiss, so a platform may work them out on demand.
 */
export interface OutsidePress<T extends PlatformTypes = PlatformTypes> {
	/** The platform's event, passed on in the change details. */
	readonly event: PlatformEvent<T, OutsidePressReason>;
	/** Core's word for the event: `click` for the end of a press, anything else for its start or a touch. */
	readonly eventType: InteractionEventType | undefined;
	/** Whether the event passed through the popup or the element it is anchored to. */
	readonly inOwnElements: boolean;
	/** Whether a click reports a press behind it: not one from the keyboard or assistive technology. */
	readonly pressBacked: boolean;
	/**
	 * Whether the press landed where one never dismisses: another trigger, a popup nested in this
	 * one, an element added after the popup opened, a scrollbar.
	 */
	readonly spared: boolean;
	/**
	 * Whether the popup's kind lets this press dismiss it, by its own test of where and how it
	 * landed (a dialog: the main button, and its own backdrop when it has one). Read only when the
	 * press would otherwise dismiss. Absent, it does.
	 */
	readonly dismissible?: boolean | undefined;
}

/** What a popup's dismissal is given once. */
export interface DismissInteractionDeps<T extends PlatformTypes = PlatformTypes> {
	/**
	 * The popup it dismisses, which builds it: an open child in its tree may answer a dismissal
	 * before it.
	 */
	readonly popup: Pick<PopupView<T>, "open" | "tree" | "nodeId" | "platform">;
	/** Closes the popup with the dismissal's details. */
	readonly close: (details: DismissChangeDetails<T>) => void;
}

/**
 * One popup's dismissal, shared by its Root, its triggers and its popup element. A popup store
 * builds one; the platform calls it with what happened.
 */
export class DismissInteraction<T extends PlatformTypes = PlatformTypes> {
	readonly #view: DismissInteractionDeps<T>["popup"];
	readonly #props: () => DismissInteractionProps;
	readonly #close: (details: DismissChangeDetails<T>) => void;

	// The press being followed.
	#pressStartedInside = false;
	#pressStartPrevented = false;
	#suppressNextOutsideClick = false;
	#sawPressWhileOpen = false;
	#pointerType: PointerType = "";
	#touch: {
		startX: number;
		startY: number;
		dismissOnEnd: boolean;
		dismissOnPress: boolean;
	} | null = null;
	// Text is being composed: its Escape closes the composition, not the popup.
	#composing = false;
	// A press or focus is passing through the popup's own elements right now. A press from a popup
	// nested in this one marks this one's node in the tree instead.
	#inside = false;

	readonly #longTouchTimeout: Timeout;
	readonly #suppressionTimeout: Timeout;
	readonly #insideTimeout: Timeout;
	readonly #compositionTimeout: Timeout;

	/** `props` is asked whenever a decision needs one, so its answers may change. */
	constructor(props: () => DismissInteractionProps, deps: DismissInteractionDeps<T>) {
		const view = deps.popup;
		this.#view = view;
		this.#props = props;
		this.#close = deps.close;
		const scheduler = view.platform.scheduler;
		this.#longTouchTimeout = new Timeout(scheduler);
		this.#suppressionTimeout = new Timeout(scheduler);
		this.#insideTimeout = new Timeout(scheduler);
		this.#compositionTimeout = new Timeout(scheduler);
	}

	/** Whether Escape and outside presses dismiss now. */
	get enabled(): boolean {
		return this.#props().enabled ?? true;
	}

	/**
	 * Whether a press or focus is passing through the popup's own elements, or a press from a popup
	 * nested in it, right now: it isn't an outside press. The focus behaviour reads it too.
	 */
	get insideTree(): boolean {
		const view = this.#view;
		return this.#inside || (view.tree?.isInside(view.nodeId) ?? false);
	}

	/** The press type for the pointer of the press being followed. */
	get pressType(): PressType {
		return resolvePressType(this.#pointerType, this.#props().outsidePressEvent ?? "sloppy");
	}

	// Escape

	/**
	 * Escape was pressed while the popup, a trigger or the page had focus. `composing` is the
	 * platform's own word that the key belongs to a text composition. Returns what to do with the
	 * event when the popup closed for it, else `null`.
	 */
	escape = (event: PlatformEvent<T, EscapeReason>, composing = false): EscapeOutcome | null => {
		const view = this.#view;
		if (!view.open || !this.enabled) {
			return null;
		}
		if (this.#composing || composing) {
			return null;
		}
		// An open popup nested in this one answers Escape first.
		if (hasBlockingChild(view.tree, view.nodeId, "escapeKey")) {
			return null;
		}
		const details = createChangeEventDetails<EscapeReason, {}, T>(REASONS.escapeKey, event);
		this.#close(details);
		return {
			preventDefault: !details.isCanceled,
			stopPropagation: !details.isPropagationAllowed,
		};
	};

	/**
	 * A text composition ended. `settleMs` keeps it counted that long: a platform that reports the
	 * end before the key that ended it passes a few milliseconds.
	 */
	compositionEnd = (settleMs: number): void => {
		if (settleMs <= 0) {
			this.#compositionTimeout.clear();
			this.#composing = false;
			return;
		}
		this.#composing = true;
		this.#compositionTimeout.start(settleMs, () => {
			this.#composing = false;
		});
	};

	// Presses inside the popup

	/**
	 * A press is passing through the popup's own elements: it isn't an outside press for the
	 * popup or for the popups it is nested in, until the next task.
	 */
	markInside = (): void => {
		const { tree, nodeId } = this.#view;
		this.enterInside();
		const ancestors = tree ? tree.ancestors(nodeId) : [];
		for (const node of ancestors) {
			if (node.context) {
				tree?.markInside(node.id);
			}
		}
		this.#insideTimeout.start(0, () => {
			this.clearInside();
			for (const node of ancestors) {
				if (node.context) {
					tree?.clearInside(node.id);
				}
			}
		});
	};

	/** Forgets the press that passed through the popup. */
	clearInside = (): void => {
		this.#insideTimeout.clear();
		this.leaveInside();
	};

	/** Focus or a press is passing through the popup's own elements (until `leaveInside`). */
	enterInside = (): void => {
		this.#inside = true;
	};

	/** Nothing passes through the popup any more; its pending mark, if any, still runs out. */
	leaveInside = (): void => {
		const { tree, nodeId } = this.#view;
		this.#inside = false;
		if (nodeId !== undefined) {
			tree?.clearInside(nodeId);
		}
	};

	/** A press began. `inPopup`: on the popup's own subtree, not a popup nested in it. */
	pressStart = (button: number, inPopup: boolean): void => {
		if (!this.#view.open || !this.enabled || button !== 0 || !inPopup) {
			return;
		}
		if (!this.#pressStartedInside) {
			this.#pressStartedInside = true;
			this.#pressStartPrevented = false;
		}
	};

	/** The start of a press on the popup had its default action prevented (a drag handle). */
	pressStartPrevented = (): void => {
		if (!this.#view.open || !this.enabled) {
			return;
		}
		if (this.#pressStartedInside) {
			this.#pressStartPrevented = true;
		}
	};

	// Presses anywhere, while the popup is open

	/**
	 * A press event is on its way to its target. `pointerType` comes with the event that starts a
	 * press with a pointer (web: `pointerdown`); `compatibility` marks the mouse press that follows
	 * it (web: `mousedown`), which a touch makes too. Returns whether the event is followed to its
	 * target: not the mouse press of a touch that lasted too long.
	 */
	pressSeen = (press: {
		readonly button: number;
		readonly pointerType?: PointerType | undefined;
		readonly compatibility?: boolean | undefined;
	}): boolean => {
		this.#longTouchTimeout.clear();
		if (press.pointerType !== undefined) {
			// Only the primary button's press is followed by a click.
			if (press.button === 0) {
				this.#sawPressWhileOpen = true;
			}
			this.#pointerType = press.pointerType;
		}
		return !(press.compatibility && this.#touch && !this.#touch.dismissOnPress);
	};

	/**
	 * The start of a press with a pointer reached its target. `touch`: the pointer is a finger,
	 * whose press is followed as a touch instead.
	 */
	pointerPress = (press: OutsidePress<T>, touch: boolean): void => {
		if (
			this.pressType !== "sloppy" ||
			touch ||
			!this.#view.open ||
			!this.enabled ||
			press.inOwnElements
		) {
			return;
		}
		this.press(press);
	};

	/** A press reached its target: closes the popup when it is an outside press that dismisses. */
	press = (press: OutsidePress<T>): void => {
		const view = this.#view;
		const pressType = this.pressType;
		if (isIgnoredOutsidePress(press.eventType, pressType)) {
			// A new press outside clears leftover drag-out suppression, so its click can dismiss.
			if (press.eventType !== "click" && !press.inOwnElements) {
				this.#suppressionTimeout.clear();
				this.#suppressNextOutsideClick = false;
			}
			this.clearInside();
			return;
		}
		if (this.insideTree) {
			this.clearInside();
			return;
		}
		if (press.spared) {
			return;
		}
		if (pressType === "intentional") {
			if (isTrailingClick(press.pressBacked, this.#sawPressWhileOpen)) {
				return;
			}
			// A press that started inside and ended outside suppresses one outside click.
			if (this.#suppressNextOutsideClick) {
				this.#suppressionTimeout.clear();
				this.#suppressNextOutsideClick = false;
				return;
			}
		}
		if (press.dismissible === false) {
			return;
		}
		if (hasBlockingChild(view.tree, view.nodeId, "outsidePress")) {
			return;
		}
		this.#close(
			createChangeEventDetails<OutsidePressReason, {}, T>(REASONS.outsidePress, press.event),
		);
		this.clearInside();
	};

	/**
	 * A whole press reached its target, on a platform that reports a press as one event (a tap)
	 * and not as its start, its end and the click after them. `pointerType` is the pointer that
	 * made it. Such a press is its own start and its own click, so it dismisses under either press
	 * type: closes the popup unless the press landed in its own elements or where one never
	 * dismisses.
	 */
	wholePress = (press: OutsidePress<T>, pointerType: PointerType): void => {
		const view = this.#view;
		this.#longTouchTimeout.clear();
		this.#pointerType = pointerType;
		if (!view.open || !this.enabled) {
			return;
		}
		if (this.insideTree) {
			this.clearInside();
			return;
		}
		if (press.inOwnElements || press.spared || press.dismissible === false) {
			return;
		}
		if (hasBlockingChild(view.tree, view.nodeId, "outsidePress")) {
			return;
		}
		this.#close(
			createChangeEventDetails<OutsidePressReason, {}, T>(REASONS.outsidePress, press.event),
		);
		this.clearInside();
	};

	/**
	 * A press ended or was cancelled, anywhere. `endedInTree`: in the popup, its anchor or a popup
	 * nested in it; read only for a press that began inside. `dismissible`: the kind's own test of
	 * the press, as for {@link OutsidePress}; read only for a press dragged out, whose next outside
	 * click it otherwise keeps from dismissing.
	 */
	pressEnd = (end: {
		readonly canceled: boolean;
		readonly endedInTree: boolean;
		readonly dismissible?: boolean | undefined;
	}): void => {
		// A cancelled gesture makes no click; a finished one keeps the press for the click after it.
		if (end.canceled) {
			this.#sawPressWhileOpen = false;
		}
		if (!this.#pressStartedInside) {
			return;
		}
		const startPrevented = this.#pressStartPrevented;
		this.#resetPressStart();
		const pressType = this.pressType;
		if (pressType !== "intentional") {
			return;
		}
		const outcome = pressEndOutcome({
			pressType,
			canceled: end.canceled,
			startPrevented,
			endedInTree: !end.canceled && end.endedInTree,
		});
		if (outcome === "suppress-immediate") {
			this.#suppressNextOutsideClick = true;
			this.#suppressionTimeout.start(0, () => {
				this.#suppressNextOutsideClick = false;
			});
		} else if (outcome === "suppress-next" && end.dismissible !== false) {
			this.#suppressionTimeout.clear();
			this.#suppressNextOutsideClick = true;
			this.clearInside();
		}
	};

	// Touches

	/** A touch began somewhere: the press being followed is a finger's. */
	touchSeen = (): void => {
		this.#pointerType = "touch";
	};

	/** A touch reached its target. `point`: where it is, or `null` when the platform has none. */
	touchStart = (point: Point | null, inOwnElements: boolean): void => {
		if (this.pressType !== "sloppy" || !this.#view.open || !this.enabled || inOwnElements) {
			return;
		}
		if (point) {
			this.#touch = {
				startX: point.x,
				startY: point.y,
				dismissOnEnd: false,
				dismissOnPress: true,
			};
			this.#longTouchTimeout.start(LONG_TOUCH_MS, () => {
				if (this.#touch) {
					this.#touch.dismissOnEnd = false;
					this.#touch.dismissOnPress = false;
				}
			});
		}
	};

	/** The touch moved: far enough, it dismisses when it ends, or at once. */
	touchMove = (point: Point | null, press: OutsidePress<T>): void => {
		const touch = this.#touch;
		if (this.pressType !== "sloppy" || !touch || press.inOwnElements || !point) {
			return;
		}
		const outcome = touchMoveOutcome(touch.startX, touch.startY, point.x, point.y);
		if (outcome !== "none") {
			touch.dismissOnEnd = true;
		}
		if (outcome === "dismiss") {
			this.press(press);
			this.#longTouchTimeout.clear();
			this.#touch = null;
		}
	};

	/** The touch ended. */
	touchEnd = (press: OutsidePress<T>): void => {
		const touch = this.#touch;
		if (this.pressType !== "sloppy" || !touch || press.inOwnElements) {
			return;
		}
		if (touch.dismissOnEnd) {
			this.press(press);
		}
		this.#longTouchTimeout.clear();
		this.#touch = null;
	};

	// The popup's own changes

	/** The popup closed for a moment, even without rendering closed: the next press is a new one. */
	closed = (): void => {
		this.#sawPressWhileOpen = false;
	};

	/** The popup is closed: forgets the press, the touch and the composition. */
	reset = (): void => {
		this.#composing = false;
		this.#sawPressWhileOpen = false;
		this.#pointerType = "";
		this.#touch = null;
	};

	/** The platform stopped listening for presses: drops the one in progress and its suppression. */
	listeningStopped = (): void => {
		this.#suppressionTimeout.clear();
		this.#resetPressStart();
		this.#suppressNextOutsideClick = false;
	};

	/** The popup's Root went away: drops the timers. */
	stop = (): void => {
		this.clearInside();
		this.#longTouchTimeout.clear();
		this.#compositionTimeout.clear();
	};

	#resetPressStart(): void {
		this.#pressStartedInside = false;
		this.#pressStartPrevented = false;
	}
}
