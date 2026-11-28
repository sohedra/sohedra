import { untrack } from "svelte";

import type { DismissInteractionProps, PressType } from "../../foundation/dismiss/index.js";
import { TriggerFocusGuards } from "../../foundation/focus/index.js";
import type { HoverInteraction } from "../../foundation/hover/index.js";
import { OwnedValue, type PlatformTypes, REASONS, Timeout } from "../../foundation/kernel/index.js";
import {
	type ClosePartCount,
	closePartCount,
	type InteractionType,
	type OpenChangeSource,
	POPUP_BEHAVIOR,
	type PopupHooks,
	type PopupRequest,
	PopupStore,
	type PopupStoreDeps,
	type PopupStoreKind,
	type PopupStoreProps,
	type PopupTriggerData,
	pressOpenState,
} from "../../foundation/popup/index.js";
import type { PopoverHandle } from "./popover-handle.js";
import {
	closeTakesActiveTrigger,
	isTouchPressOpen,
	PATIENT_CLICK_THRESHOLD,
	popoverInstantType,
	popoverOutsidePress,
	triggerHasFocusGuards,
} from "./popover-rules.js";
import type {
	PopoverBackdropState,
	PopoverRootChangeEventDetails,
	PopoverTriggerState,
} from "./popover-types.js";

/** The Popover.Root props the store reads. The `open` binding is one of the deps. */
export interface PopoverStoreProps<Payload, T extends PlatformTypes> extends PopupStoreProps<
	PopoverRootChangeEventDetails<T>
> {
	readonly modal: boolean | "trap-focus" | undefined;
	/** The handle that controls the popover and its detached triggers. */
	readonly handle?: PopoverHandle<Payload> | undefined;
}

/** What a popover is given once: the popup's deps. The `open` binding is one of them. */
export type PopoverStoreDeps<T extends PlatformTypes = PlatformTypes> = PopupStoreDeps<T>;

/** Data the trigger that owns the popup forwards to it. */
export interface PopoverTriggerData<Payload> extends PopupTriggerData<Payload> {
	readonly disabled: boolean;
	readonly openOnHover: boolean;
	readonly closeDelay: number;
}

/** What the platform knows about a popover open change, passed with {@link PopoverStore.setOpen}. */
export interface PopoverOpenChangeSource extends OpenChangeSource {
	/** A trigger press without a pointer (Enter or Space): skips transitions (`instant: 'click'`). */
	readonly keyboardClick?: boolean | undefined;
}

type Details<T extends PlatformTypes> = PopoverRootChangeEventDetails<T>;

/** Popover's kind of popup: its name and its behaviour row. */
const POPOVER_KIND: PopupStoreKind = {
	name: "Popover",
	behavior: POPUP_BEHAVIOR.popover,
};
type Request<T extends PlatformTypes> = PopupRequest<Details<T>, PopoverOpenChangeSource>;

/** A popover's state, shared by its parts through the web's `PopoverRootContext`. */
export class PopoverStore<
	Payload = unknown,
	T extends PlatformTypes = PlatformTypes,
> extends PopupStore<Payload, T, Details<T>, PopoverOpenChangeSource> {
	// 1. Inputs
	readonly #props: () => PopoverStoreProps<Payload, T>;

	/**
	 * What Popover adds to the open pipeline: a close press without a trigger takes the active
	 * one, and each accepted change sets the stick flag and the instant type.
	 */
	protected readonly hooks: PopupHooks<Details<T>, PopoverOpenChangeSource, this> = {
		close: (request) => {
			const { details } = request;
			const activeTriggerId = this.activeTriggerId;
			if (
				closeTakesActiveTrigger(
					request.next,
					details.reason,
					details.trigger != null,
					activeTriggerId,
				)
			) {
				details.trigger =
					this.triggers.getById(activeTriggerId as string) ??
					this.activeTriggerElement ??
					undefined;
			}
		},
		opened: (_popover, request) => this.#accepted(request),
		closed: (_popover, request) => this.#accepted(request),
		openChanged: (open) => {
			if (!open) {
				this.#stickTimeout.clear();
			}
		},
		unmounted: () => {
			this.#stick = true;
		},
	};

	// 2. Owned objects
	// Popover's behaviour row has `hover`, so the hover state is always built.
	declare readonly hover: HoverInteraction<T>;
	readonly #stickTimeout: Timeout;
	/** Close parts rendered inside the Popup; a modal popover traps focus only with one. */
	readonly closeParts: ClosePartCount = closePartCount();
	readonly titleId: OwnedValue<string> = new OwnedValue<string>();
	readonly descriptionId: OwnedValue<string> = new OwnedValue<string>();
	/**
	 * The focus guards that bridge Tab between the active trigger and the portalled popup (set by
	 * the trigger and the Popup's focus manager): bookkeeping nothing renders.
	 */
	readonly guards: TriggerFocusGuards<T> = new TriggerFocusGuards<T>();

	/** Whether a press keeps a hovered popover open. Set by a hover opening; reset on unmount. */
	#stick = true;

	// Forwarded from the trigger that owns the popup.
	#disabled = $state(false);
	#openOnHover = $state(false);
	#closeDelay = $state(0);

	// 3. Public state. `$derived.by` because `#props` is assigned in the constructor, after these
	// initialisers.
	readonly modal: boolean | "trap-focus" = $derived.by(() => this.#props().modal ?? false);
	/** Whether the Popup traps focus: modal, with a Close part inside it. */
	readonly focusManagerModal: boolean = $derived.by(
		() => this.modal !== false && this.closeParts.count > 0,
	);
	/** Whether the Popup keeps a hover-opened popover open while hovered. */
	readonly hoverFloatingEnabled: boolean = $derived.by(() => this.#openOnHover && !this.#disabled);
	/**
	 * Whether the Popup's focus management is off: while unmounted, and for a hover-opened popover,
	 * which never takes focus.
	 */
	readonly focusManagerDisabled: boolean = $derived.by(
		() => !this.mounted || this.openChangeReason === REASONS.triggerHover,
	);
	/**
	 * Whether the Positioner renders the internal backdrop: a `modal={true}` popover that wasn't
	 * opened by hovering.
	 */
	readonly hasInternalBackdrop: boolean = $derived.by(
		() => this.modal === true && this.openChangeReason !== REASONS.triggerHover,
	);
	/** Whether the Positioner renders the internal backdrop now: mounted, with one. */
	readonly internalBackdropMounted: boolean = $derived.by(
		() => this.mounted && this.hasInternalBackdrop,
	);
	/** Whether the page scroll is locked: an open popover with the internal backdrop. */
	readonly anchoredScrollLockEnabled: boolean = $derived.by(
		() => this.open && this.hasInternalBackdrop,
	);
	/**
	 * Whether the Positioner lets pointer input through: while closed (closing, or kept mounted),
	 * so it doesn't block the page.
	 */
	readonly positionerIgnoresPointer: boolean = $derived.by(() => !this.open);
	/** How an outside press dismisses the popover: the behaviour row's answer, live for `modal`. */
	readonly outsidePressEvent: { mouse: PressType; touch: PressType } = $derived.by(() =>
		popoverOutsidePress(this.modal),
	);

	/** The Backdrop part's state. */
	readonly backdropState: PopoverBackdropState = $derived.by(() => ({
		open: this.open,
		transitionStatus: this.transitionStatus,
	}));
	/**
	 * Whether the Backdrop lets pointer input through: a hover-opened popover's, so leaving the
	 * popup closes it.
	 */
	readonly backdropPassesPointer: boolean = $derived.by(
		() => this.openChangeReason === REASONS.triggerHover,
	);

	/** Pure: reads no context. `props` is called inside the deriveds, so each prop stays reactive. */
	constructor(props: () => PopoverStoreProps<Payload, T>, deps: PopoverStoreDeps<T>) {
		super(props, { ...deps, kind: POPOVER_KIND });
		this.#props = props;
		this.#stickTimeout = new Timeout(deps.platform.scheduler);
	}

	/** Whether the owning trigger is disabled. */
	get disabled(): boolean {
		return this.#disabled;
	}

	/** A mouse press outside dismisses differently while the popover traps focus. */
	protected override get dismissProps(): DismissInteractionProps {
		return { outsidePressEvent: this.outsidePressEvent };
	}

	/** Whether the owning trigger opens the popover on hover. */
	get openOnHover(): boolean {
		return this.#openOnHover;
	}

	/** The handle that controls the popover and its detached triggers. */
	get handle(): PopoverHandle<Payload> | undefined {
		return this.#props().handle;
	}

	/** The owning trigger's hover close delay. */
	get closeDelay(): number {
		return this.#closeDelay;
	}

	/**
	 * Whether a trigger press keeps a hover-opened popover open (an impatient click). A fact of
	 * the opening: only read when a trigger is pressed, so it isn't reactive.
	 */
	get stickIfOpen(): boolean {
		return this.#stick;
	}

	/** A trigger's state: whether it is disabled, and whether the popover is open from it. */
	triggerState(triggerId: string, disabled: boolean): PopoverTriggerState {
		return { disabled, open: this.activeTrigger.isOpenedBy(triggerId) };
	}

	/** Whether the trigger with `triggerId` opened the popup with a press. */
	isPressOpenedByTrigger(triggerId: string | undefined): boolean {
		return (
			this.openChangeReason === REASONS.triggerPress && this.activeTrigger.isOpenedBy(triggerId)
		);
	}

	/** Whether a hover-enabled popover was opened by a touch press. */
	isTouchPressOpen(openOnHover: boolean): boolean {
		return isTouchPressOpen(openOnHover, this.openMethod, this.openChangeReason);
	}

	/** Whether a trigger with these options opens on hover (not after a touch press opened it). */
	triggerHoverEnabled(openOnHover: boolean, disabled: boolean): boolean {
		return !disabled && openOnHover && !this.isTouchPressOpen(openOnHover);
	}

	/**
	 * The Popup's default initial focus: the popup itself when opened by touch (so the virtual
	 * keyboard doesn't open), else its first tabbable element (`true`).
	 */
	defaultInitialFocus = (interactionType: InteractionType): T["element"] | null | true =>
		interactionType === "touch" ? this.popupElement : true;

	/** The Popup's initial focus: its `initialFocus` prop when given, else the default. */
	resolveInitialFocus<Target>(
		initialFocus: Target | undefined,
	): Target | ((interactionType: InteractionType) => T["element"] | null | true) {
		return initialFocus === undefined ? this.defaultInitialFocus : initialFocus;
	}

	/**
	 * The open state a trigger press asks for: opens a closed popup or one owned by another
	 * trigger; on the owning trigger, closes it, unless it was hover-opened within the
	 * patient-click threshold.
	 */
	pressOpen(isActiveReference: boolean): boolean {
		return untrack(() =>
			pressOpenState(this.open, isActiveReference, this.openEventType, this.stickIfOpen),
		);
	}

	/**
	 * Whether the trigger renders the focus guards that bridge Tab into a non-modal popup: not
	 * while a hover holds the popover open.
	 */
	hasTriggerFocusGuards(triggerId: string | undefined): boolean {
		return triggerHasFocusGuards(
			this.activeTrigger.isOpenedBy(triggerId),
			this.focusManagerModal,
			this.openChangeReason,
		);
	}

	// 4. Intents
	/**
	 * A press on a trigger: opens the popover, closes it from the trigger that owns it, or pins one
	 * that hover opened. `element` is the trigger that was pressed. Returns whether it changed.
	 */
	pressTrigger = (
		element: T["element"],
		details: Omit<Details<T>, "preventUnmountOnClose">,
		source: PopoverOpenChangeSource,
	): boolean => this.setOpen(this.pressOpen(this.anchorElement === element), details, source);

	/** A close from outside a trigger: a Close part, or `close()` on the Root or the handle. */
	close = (details: Omit<Details<T>, "preventUnmountOnClose">): boolean =>
		this.setOpen(false, details);

	/** Applies the owning trigger's forwarded data. */
	override applyTriggerData(data: PopoverTriggerData<Payload>): void {
		super.applyTriggerData(data);
		this.#disabled = data.disabled;
		this.#openOnHover = data.openOnHover;
		this.#closeDelay = data.closeDelay;
	}

	/** An accepted change, after the commit. */
	#accepted({ next, details, source }: Request<T>): void {
		if (details.reason === REASONS.triggerHover) {
			// Only a "patient" click closes a hover-opened popover: one within the threshold sticks.
			this.#stick = true;
			this.#stickTimeout.start(PATIENT_CLICK_THRESHOLD, () => {
				this.#stick = false;
			});
		}
		this.setInstantType(popoverInstantType(next, details.reason, source.keyboardClick === true));
	}

	// 5. Lifetime work. Called once by Popover.Root.
	override connect(): void {
		super.connect();
		// The stick timer never outlives the Root.
		$effect(() => this.#stickTimeout.clear);
	}
}
