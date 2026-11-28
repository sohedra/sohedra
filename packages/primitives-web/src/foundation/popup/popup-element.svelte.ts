// The Popup part's work on the web: it hands the popup element to its store, reports a finished
// opening after the enter animations, hears Escape and presses inside, keeps a hovered popup
// open, and manages focus for a popup that takes it. Which of these a kind has is read from its
// behaviour row.
import type { OwnedValue } from "@sohedra/primitives-core/foundation/kernel/index.js";
import type {
	InteractionType,
	PopupBehavior,
} from "@sohedra/primitives-core/foundation/popup/index.js";
import type { TransitionStatus } from "@sohedra/primitives-core/foundation/presence/index.js";
import { getAbortSignal, untrack } from "svelte";
import type { Attachment } from "svelte/attachments";

import { type DismissPopupView, useDismissPopup } from "../dismiss/index.js";
import {
	type FocusGuardProps,
	type FocusManagerView,
	type FocusTarget,
	type TriggerFocusBridge,
	useFocusManager,
} from "../focus/index.js";
import { type HoverPopupView, useHoverPopup } from "../hover/index.js";
import {
	attachClaim,
	attachmentProps,
	attachRef,
	mergeProps,
	mergeStyles,
	type Props,
} from "../kernel/index.js";
import { PortalContext } from "../portal/index.js";
import { PopupLayoutContext } from "../position/index.js";
import { DISABLED_TRANSITIONS_STYLE, waitForAnimations } from "../presence/index.js";

/** What `usePopupElement` reads of its store and asks of it. A popup store is one as it is. */
export type PopupElementView = DismissPopupView &
	HoverPopupView &
	FocusManagerView &
	TriggerFocusBridge &
	PopupElementState;

/** What `usePopupElement` reads of its store beside the dismiss, hover and focus views. */
interface PopupElementState {
	/** The kind's row of the behaviour table: whether it hovers and manages focus. */
	readonly behavior: PopupBehavior;
	readonly transitionStatus: TransitionStatus;
	readonly popupElement: Element | null;
	/** How the popup was opened, while it is open. */
	readonly openMethod: InteractionType | null;
	/** Whether the focus manager is off now. */
	readonly focusManagerDisabled: boolean;
	/** Whether the popup traps focus now. */
	readonly focusManagerModal: boolean;
	/** Whether a hovered popup stays open now. */
	readonly hoverFloatingEnabled: boolean;
	/** How long a hover close waits once the pointer leaves the popup. */
	readonly closeDelay: number;
	/** The popup element's id, claimed while the element is in the document. */
	readonly popupIdClaim: OwnedValue<string>;
	/** The initial focus: the part's prop when given, else the kind's default. */
	resolveInitialFocus<Target>(initialFocus: Target | undefined): unknown;
	setPopupElement(element: Element | null): void;
	/** Reports a finished opening. */
	completeOpen(): void;
}

/** What the Popup part tells `usePopupElement`, from its options function. */
export interface PopupElementOptions {
	/** The user's `id` prop: triggers point `aria-controls` at it while it is claimed. */
	readonly id: string | undefined;
	/** The `initialFocus` prop. */
	readonly initialFocus?: FocusTarget;
	/** The `finalFocus` prop. */
	readonly finalFocus?: FocusTarget;
}

/** What `usePopupElement` returns. */
export interface PopupElement {
	/**
	 * For the popup element: the dismissal's handlers and, as attachments inside, the element's
	 * handover to the store, the report of a finished opening and the claim of its id.
	 */
	readonly props: Props;
	/** The element's style: no transitions on the first frame, then a Viewport's measured size. */
	readonly style: string | undefined;
	/** Whether the focus guards render around the popup element. */
	readonly guarded: boolean;
	readonly guardBefore: FocusGuardProps;
	readonly guardAfter: FocusGuardProps;
}

/**
 * On the popup element: reports a finished opening to `onOpenChangeComplete(true)` once the
 * popup's enter animations are done.
 */
function attachOpenComplete(store: PopupElementView): Attachment<HTMLElement> {
	return (element) => {
		// Waits for the enter animations of an open popup, then reports the opening complete.
		$effect(() => {
			if (!store.open) {
				return;
			}
			const signal = getAbortSignal();
			untrack(() =>
				waitForAnimations(
					element,
					{ waitForStartingStyleRemoved: true, signal },
					store.completeOpen,
				),
			);
		});
	};
}

const NO_GUARDS = { renderGuards: false, beforeGuard: {}, afterGuard: {} } as const;

/**
 * The Popup part's work: hands the element to the store, reports a finished opening, hears
 * Escape and presses inside, keeps a hovered popup open (a kind whose row has `hover`) and
 * manages focus (a kind whose row has `restoreFocus`). Call once while the Popup part initialises:
 * it reads the portal and layout contexts and starts its own effects.
 */
export function usePopupElement(
	store: PopupElementView,
	options: () => PopupElementOptions,
): PopupElement {
	const behavior = store.behavior;
	const portal = PortalContext.getOr(null);
	const layout = PopupLayoutContext.getOr(null);

	// A hover-opened popup stays open while the popup is hovered.
	if (behavior.hover) {
		useHoverPopup(store, () => ({
			enabled: store.hoverFloatingEnabled,
			closeDelay: store.closeDelay,
		}));
	}
	// Escape while the popup has focus, and the presses that begin in it or pass through it.
	const dismiss = useDismissPopup(store);
	// Focus: the store is the manager's view of the popup and its Tab bridge to the trigger.
	const focus =
		behavior.restoreFocus === undefined
			? NO_GUARDS
			: useFocusManager(
					store,
					() => ({
						disabled: store.focusManagerDisabled,
						modal: store.focusManagerModal,
						initialFocus: store.resolveInitialFocus(options().initialFocus) as FocusTarget,
						returnFocus: options().finalFocus,
						restoreFocus: behavior.restoreFocus,
						openInteractionType: store.openMethod,
					}),
					{ portal, bridge: store },
				);

	const own = attachmentProps(
		attachRef<HTMLElement>(
			(element) => store.setPopupElement(element),
			() => store.popupElement as HTMLElement | null,
		),
		attachOpenComplete(store),
		// The popup's id is the user's when given, claimed while the element is in the document:
		// triggers point `aria-controls` at it.
		attachClaim(
			(token, value: string) => store.popupIdClaim.claim(token, value),
			() => options().id,
		),
	);
	const props = mergeProps(dismiss.props as Props, own);
	const style = $derived(
		mergeStyles(
			store.transitionStatus === "starting" ? DISABLED_TRANSITIONS_STYLE : undefined,
			layout?.popupStyle || undefined,
		),
	);

	return {
		props,
		get style() {
			return style;
		},
		get guarded() {
			return focus.renderGuards;
		},
		guardBefore: focus.beforeGuard,
		guardAfter: focus.afterGuard,
	};
}
