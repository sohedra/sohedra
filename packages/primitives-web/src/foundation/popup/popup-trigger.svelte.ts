// A popup trigger's work on the web: it finds its popup (its handle's store, else its Root's),
// registers its element, forwards its data while it owns the popup and wires its kind's
// interactions. The press itself stays in the part, as one intent.

import { getHoverTiming } from "@sohedra/primitives-core/foundation/hover";
import {
	keepShallowEqual,
	missingProviderMessage,
} from "@sohedra/primitives-core/foundation/kernel";
import {
	HANDLE_STORE,
	type PopupTriggerData,
	type PopupView,
	useTriggerRegistration,
} from "@sohedra/primitives-core/foundation/popup";
import { untrack } from "svelte";
import type { HTMLAttributes } from "svelte/elements";

import { useDismissTrigger } from "../dismiss/index.js";
import { CLICK_TRIGGER_IDENTIFIER, useOpenMethod, useTriggerFocusGuards } from "../focus/index.js";
import { useHoverTrigger } from "../hover/index.js";
import {
	attachmentProps,
	attachRef,
	mergePropsN,
	type Props,
	type WebTypes,
} from "../kernel/index.js";

/** A handle as a trigger reads it: the store of the Root attached to it, else an inert one. */
export interface PopupTriggerHandle {
	readonly [HANDLE_STORE]: unknown;
}

/** What the trigger part tells `usePopupTrigger`, from its options function. */
export interface PopupTriggerOptions<Data> {
	/** The `handle` prop. */
	readonly handle: PopupTriggerHandle | undefined;
	/** The trigger's id. */
	readonly id: string;
	/** The `disabled` prop. */
	readonly disabled: boolean;
	/** What the trigger forwards to the popup while it owns it. */
	readonly data: Data;
	/** The trigger's hover props, for a kind whose row has `hover`. */
	readonly hover?:
		| {
				readonly openOnHover: boolean;
				readonly delay: number;
				readonly closeDelay: number;
		  }
		| undefined;
}

/** What `usePopupTrigger` returns. */
export interface PopupTrigger<Store> {
	/** The popup this trigger reads now: its handle's, else its Root's. */
	readonly popup: Store;
	/**
	 * For the trigger element: the handlers of the interactions the popup's kind has, the trigger
	 * marker, and, as an attachment inside, the element's registration under the trigger's id.
	 */
	readonly props: Props;
	/** Whether the focus guards render around the trigger now. */
	readonly guarded: boolean;
	readonly guardBefore: HTMLAttributes<HTMLSpanElement>;
	readonly guardAfter: HTMLAttributes<HTMLSpanElement>;
	/** Whether a composite widget around the trigger (a toolbar) owns its tab stop. */
	readonly inComposite: boolean;
}

/**
 * A popup trigger's work: finds its popup (its handle's store while it has a handle, else `root`),
 * registers its element, forwards its data while it owns the popup and wires its kind's hover,
 * open method, focus guards and Escape. `fixed.part` names the part in the error without either.
 */
export function usePopupTrigger<
	Store extends PopupView<WebTypes>,
	Data extends PopupTriggerData<unknown>,
>(
	root: Store | null,
	options: () => PopupTriggerOptions<Data>,
	fixed: { readonly part: string },
): PopupTrigger<Store> {
	// The handle the part starts with: a trigger needs a Root or a handle.
	if (!root && !options().handle) {
		throw new Error(missingProviderMessage(fixed.part, "Root", "given a handle"));
	}
	// A handle is made at module scope, before any platform: its store is this platform's once a
	// Root attaches, else an inert one. The one cast of a handle's store is here.
	const popup: Store = $derived.by(() => {
		const current = options().handle;
		return current ? (current[HANDLE_STORE] as Store) : (root as Store);
	});
	const behavior = untrack(() => popup.behavior);

	// The trigger element, for the hover behaviour, the registration and the focus guards.
	let element: HTMLElement | null = $state.raw(null);

	// Escape while the trigger has focus closes the popup.
	const dismiss = useDismissTrigger(() => ({ popup }));
	// How the popup is being opened, which the Popup's initial focus reads.
	const openMethod = behavior.trigger?.recordsOpenMethod
		? useOpenMethod(() => ({ popup }))
		: undefined;

	let hover: Props | undefined;
	const hoverRow = behavior.hover;
	if (hoverRow) {
		// Compared by value: the hover listeners are set up again only when this changes, not on
		// every open change the store's answer reads.
		const hoverEnabled = $derived.by(() => {
			const { hover: own, disabled } = options();
			return popup.triggerHoverEnabled(own?.openOnHover ?? false, disabled);
		});
		hover = useHoverTrigger(() => {
			const { hover: own, id } = options();
			return {
				popup,
				enabled: hoverEnabled,
				...getHoverTiming(hoverRow, own?.delay ?? 0, own?.closeDelay ?? 0),
				safePolygon: true,
				isActiveTrigger: popup.activeTrigger.isActive(id),
				triggerElement: element,
			};
		}).props;
	}

	// What the trigger forwards to the popup while it owns it: the same object while its fields
	// are equal, so the registration forwards again only when one changes.
	const data: Data = $derived.by(keepShallowEqual(() => options().data));
	useTriggerRegistration<WebTypes, Data>(() => ({
		popup,
		id: options().id,
		element,
		data,
	}));

	// The guards that carry Tab between the trigger and its portalled popup.
	const guards = behavior.trigger?.focusGuards
		? useTriggerFocusGuards(() => ({ popup, trigger: element }))
		: { guardBefore: {}, guardAfter: {} };

	const props = mergePropsN([
		hover,
		dismiss.props,
		openMethod?.props,
		{ [CLICK_TRIGGER_IDENTIFIER]: "" },
		attachmentProps(attachRef<HTMLElement>((trigger) => (element = trigger))),
	]);

	return {
		get popup() {
			return popup;
		},
		props,
		get guarded() {
			return behavior.trigger?.focusGuards === true && popup.hasTriggerFocusGuards(options().id);
		},
		guardBefore: guards.guardBefore,
		guardAfter: guards.guardAfter,
		// The composite widgets set no context the trigger reads yet: none owns its tab stop.
		inComposite: false,
	};
}
