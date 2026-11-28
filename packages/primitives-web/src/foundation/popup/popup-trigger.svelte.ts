import { getHoverTiming } from "@sohedra/primitives-core/foundation/hover/index.js";
// A popup trigger's work on the web: it finds the trigger's popup (its handle's store, else its
// Root's), registers the element under the trigger's id, forwards the trigger's data while it
// owns the popup, and wires the interactions the popup's kind has. The press itself stays in the
// part, as one intent.
import {
	type DefinedContext,
	keepShallowEqual,
} from "@sohedra/primitives-core/foundation/kernel/index.js";
import {
	type PopupBehavior,
	type PopupTriggerData,
	type TriggerRegistrationView,
	useTriggerRegistration,
} from "@sohedra/primitives-core/foundation/popup/index.js";
import { untrack } from "svelte";

import { type DismissTriggerView, useDismissTrigger } from "../dismiss/index.js";
import {
	CLICK_TRIGGER_IDENTIFIER,
	type FocusGuardProps,
	type OpenMethodView,
	type TriggerFocusGuardsView,
	useOpenMethod,
	useTriggerFocusGuards,
} from "../focus/index.js";
import { type HoverPopupView, useHoverTrigger } from "../hover/index.js";
import {
	attachmentProps,
	attachRef,
	mergePropsN,
	type Props,
	type WebTypes,
} from "../kernel/index.js";

/** What `usePopupTrigger` reads of the trigger's popup and asks of it. A popup store is one. */
export type PopupTriggerView<Data> = HoverPopupView &
	DismissTriggerView &
	OpenMethodView &
	TriggerFocusGuardsView &
	TriggerRegistrationView<WebTypes, Data> &
	PopupTriggerState<Data>;

/** What `usePopupTrigger` reads of its popup beside the hover, dismiss and focus views. */
interface PopupTriggerState<Data> {
	/** The kind's row of the behaviour table: which interactions the trigger wires. */
	readonly behavior: PopupBehavior;
	readonly activeTrigger: TriggerRegistrationView<WebTypes, Data>["activeTrigger"] & {
		isActive(triggerId: string | undefined): boolean;
	};
	/** Whether a trigger with these options opens the popup on hover now. */
	triggerHoverEnabled(openOnHover: boolean, disabled: boolean): boolean;
	/** Whether the trigger with `triggerId` renders the focus guards now. */
	hasTriggerFocusGuards(triggerId: string | undefined): boolean;
}

/** A handle as a trigger reads it: the store of the Root attached to it, else an inert one. */
export interface PopupTriggerHandle {
	readonly store: unknown;
}

/** What the trigger part tells `usePopupTrigger`, from its options function. */
export interface PopupTriggerOptions<Data> {
	/** The part's public name, for the error when it has neither a Root nor a handle. */
	readonly part: string;
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
	readonly guardBefore: FocusGuardProps;
	readonly guardAfter: FocusGuardProps;
	/** Whether a composite widget around the trigger (a toolbar) owns its tab stop. */
	readonly inComposite: boolean;
}

/**
 * A popup trigger's work: finds its popup, registers its element, forwards its data while it owns
 * the popup, and wires what the popup's kind has: hover, the open method, focus guards, and
 * Escape while it has focus. Call once while the trigger part initialises: it reads `context`
 * (a context can be read only then) and starts its own effects. It is the one wiring that takes a
 * context, since a handle can give the trigger another store.
 */
export function usePopupTrigger<
	Store extends PopupTriggerView<Data>,
	Data extends PopupTriggerData<unknown>,
>(context: DefinedContext<Store>, options: () => PopupTriggerOptions<Data>): PopupTrigger<Store> {
	const root = context.getOr(null);
	const { part, handle } = untrack(options);
	if (!root && !handle) {
		const rootPart = `${part.split(".")[0]}.Root`;
		throw new Error(
			`Sohedra: <${part}> must be either used within a <${rootPart}> component or provided with a handle.`,
		);
	}
	// A handle is made at module scope, before any platform: its store is this platform's once a
	// Root attaches, else an inert one. The one cast of a handle's store is here.
	const popup: Store = $derived.by(() => {
		const current = options().handle;
		return current ? (current.store as Store) : (root as Store);
	});
	const behavior = untrack(() => popup.behavior);

	// The trigger element, for the hover behaviour, the registration and the focus guards.
	let element: HTMLElement | null = $state.raw(null);

	// Escape while the trigger has focus closes the popup.
	const dismiss = useDismissTrigger(() => popup);
	// How the popup is being opened, which the Popup's initial focus reads.
	const openMethod = behavior.trigger?.recordsOpenMethod ? useOpenMethod(() => popup) : undefined;

	let hover: Props | undefined;
	const hoverRow = behavior.hover;
	if (hoverRow) {
		// Compared by value: the hover listeners are set up again only when this changes, not on
		// every open change the store's answer reads.
		const hoverEnabled = $derived.by(() => {
			const { hover: own, disabled } = options();
			return popup.triggerHoverEnabled(own?.openOnHover ?? false, disabled);
		});
		hover = useHoverTrigger(
			() => popup,
			() => {
				const { hover: own, id } = options();
				return {
					enabled: hoverEnabled,
					...getHoverTiming(hoverRow, own?.delay ?? 0, own?.closeDelay ?? 0),
					safePolygon: true,
					isActiveTrigger: popup.activeTrigger.isActive(id),
					triggerElement: element,
				};
			},
		).props;
	}

	// What the trigger forwards to the popup while it owns it: the same object while its fields
	// are equal, so the registration forwards again only when one changes.
	const data: Data = $derived.by(keepShallowEqual(() => options().data));
	useTriggerRegistration<WebTypes, Data>(() => ({
		store: popup,
		id: options().id,
		element,
		data,
	}));

	// The guards that carry Tab between the trigger and its portalled popup.
	const guards = behavior.trigger?.focusGuards
		? useTriggerFocusGuards(
				() => popup,
				() => element,
			)
		: { before: {}, after: {} };

	const props = mergePropsN([
		hover,
		dismiss.props as Props,
		openMethod,
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
		guardBefore: guards.before,
		guardAfter: guards.after,
		// The composite widgets set no context the trigger reads yet: none owns its tab stop.
		inComposite: false,
	};
}
