// The Popup part's work on the web: it hands the popup element to its store, reports a finished
// opening after the enter animations, hears Escape and presses inside, keeps a hovered popup
// open, and manages focus for a popup that takes it. Which of these a kind has is read from its
// behaviour row.
import type { PopupView } from "@sohedra/primitives-core/foundation/popup/index.js";
import { getAbortSignal, untrack } from "svelte";
import type { Attachment } from "svelte/attachments";
import type { HTMLAttributes } from "svelte/elements";

import { useDismissPopup } from "../dismiss/index.js";
import { type FocusTarget, useFocusManager } from "../focus/index.js";
import { useHoverPopup } from "../hover/index.js";
import {
	attachClaim,
	attachmentProps,
	attachRef,
	mergeProps,
	mergeStyles,
	type Props,
	type WebTypes,
} from "../kernel/index.js";
import { PortalContext } from "../portal/index.js";
import { DISABLED_TRANSITIONS_STYLE, waitForAnimations } from "../presence/index.js";
import { PopupLayoutContext } from "./popup-layout.svelte.js";

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
	readonly guardBefore: HTMLAttributes<HTMLSpanElement>;
	readonly guardAfter: HTMLAttributes<HTMLSpanElement>;
}

/**
 * On the popup element: reports a finished opening to `onOpenChangeComplete(true)` once the
 * popup's enter animations are done.
 */
function attachOpenComplete(store: PopupView<WebTypes>): Attachment<HTMLElement> {
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

const NO_GUARDS = { guarded: false, guardBefore: {}, guardAfter: {} } as const;

/**
 * The Popup part's work: hands the element to the store, reports a finished opening, hears
 * Escape and presses inside, keeps a hovered popup open (a kind whose row has `hover`) and
 * manages focus (a kind whose row has `restoreFocus`). Call once while the Popup part initialises:
 * it reads the portal and layout contexts and starts its own effects.
 */
export function usePopupElement(
	store: PopupView<WebTypes>,
	options: () => PopupElementOptions,
): PopupElement {
	const behavior = store.behavior;
	const portal = PortalContext.getOr(null);
	const layout = PopupLayoutContext.getOr(null);

	// A hover-opened popup stays open while the popup is hovered.
	if (behavior.hover) {
		useHoverPopup(store, () => ({
			enabled: store.hoverPopupEnabled,
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
					// The store is the Tab bridge to the trigger: it keeps the trigger's guards.
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
	const props = mergeProps(dismiss.props, own);
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
			return focus.guarded;
		},
		guardBefore: focus.guardBefore,
		guardAfter: focus.guardAfter,
	};
}
