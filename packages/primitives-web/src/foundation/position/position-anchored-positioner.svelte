<!--
  The Positioner part of every anchored popup: it places the popup against its anchor and holds
  the position state the Popup, the Arrow and a Viewport inside read. Renders a `<div>` element,
  after the internal backdrop of a modal popup when it has one.

  A component's own Positioner file hands over its store, the context it publishes its position
  state in, what its Portal says about staying mounted, its `instant` value, its default side and
  its attribute mapping. The placement props come with the user's props.
-->
<script lang="ts" generics="Instant extends string | undefined">
	import type { DefinedContext } from "@sohedra/primitives-core/foundation/kernel/index.js";
	import type { PopupView } from "@sohedra/primitives-core/foundation/popup/index.js";
	import {
		type Align,
		type CollisionAvoidance,
		initialPosition,
		POSITIONER_DEFAULTS,
		PositionerStore,
		type Side,
	} from "@sohedra/primitives-core/foundation/position/index.js";
	import { untrack } from "svelte";

	import { INERT_MARKER } from "../focus/index.js";
	import {
		attachClaim,
		attachRef,
		DirectionContext,
		LTR,
		mergeStyles,
		Part,
		type PartUserProps,
		type StateAttributesMapping,
		type WebTypes,
	} from "../kernel/index.js";
	import { DISABLED_TRANSITIONS_STYLE } from "../presence/index.js";
	import { PopupLayoutContext, PopupLayoutStore } from "./position-popup-layout.svelte.js";
	import { usePositioner } from "./position-positioner.svelte.js";
	import type { AnchoredPositionerPlacement } from "./position-types.js";

	/**
	 * The Positioner's state, the same in every anchored popup; `instant` is each component's own
	 * type.
	 */
	interface State {
		open: boolean;
		side: Side;
		align: Align;
		anchorHidden: boolean;
		instant: Instant;
	}

	/** What the user passed to the component's Positioner: the placement props and the rest. */
	type UserProps = PartUserProps<State> & AnchoredPositionerPlacement;

	interface Props {
		/** The Positioner's view of the popup: a component passes its store. */
		popup: PopupView<WebTypes>;
		/** The component's context for this Positioner's state: its Popup, Arrow and Viewport read it. */
		context: DefinedContext<PositionerStore<WebTypes>>;
		/** Whether the component's Portal keeps the popup mounted while closed. */
		keepMounted: boolean;
		instant: Instant;
		attrs: StateAttributesMapping<State>;
		/** The side when the user gives none: a fixed answer of the kind of popup. */
		defaultSide: Side;
		/**
		 * Whether the internal backdrop of a modal popup is rendered. It sits beside the Positioner's
		 * element, with the trigger cut out so it stays pressable.
		 */
		backdrop?: boolean | undefined;
		ref?: HTMLDivElement | null | undefined;
		user: UserProps;
	}

	let {
		popup,
		context,
		keepMounted,
		instant,
		attrs,
		defaultSide,
		backdrop = false,
		ref = $bindable(null),
		user,
	}: Props = $props();

	// A part's store never changes while it is mounted.
	const view = untrack(() => popup);
	const direction = DirectionContext.getOr(LTR);

	// The position state the Popup and the Arrow read, and the sizes and anchoring a Viewport
	// inside measures.
	const positioner = new PositionerStore<WebTypes>(() => ({ keepMounted }), {
		initial: untrack(() =>
			initialPosition({
				side: user.side ?? defaultSide,
				align: user.align ?? "center",
				rtl: direction.direction === "rtl",
			}),
		),
		popup: view,
	});
	positioner.connect();
	const layout = new PopupLayoutStore();
	untrack(() => context).set(positioner);
	PopupLayoutContext.set(layout);

	const position = usePositioner(view, positioner, () => ({
		layout,
		anchor: user.anchor,
		positionMethod: user.positionMethod,
		side: user.side ?? defaultSide,
		align: user.align,
		sideOffset: user.sideOffset,
		alignOffset: user.alignOffset,
		collisionBoundary: user.collisionBoundary,
		collisionPadding: user.collisionPadding,
		arrowPadding: user.arrowPadding,
		sticky: user.sticky,
		disableAnchorTracking: user.disableAnchorTracking,
		collisionAvoidance: user.collisionAvoidance ?? POSITIONER_DEFAULTS.collisionAvoidance,
		keepMounted,
		rtl: direction.direction === "rtl",
		inert: view.positionerIgnoresPointer,
	}));

	// The popup reads this Positioner's measured state (for the safe polygon's side) while its
	// element is in the document.
	const attachPositionerClaim = attachClaim(
		(token, value: PositionerStore<WebTypes>) => view.positionerClaim.claim(token, value),
		() => positioner,
	);

	const state: State = $derived({
		open: view.open,
		side: positioner.side,
		align: positioner.align,
		anchorHidden: positioner.anchorHidden,
		instant,
	});
	// The positioned style, with no transitions on the first frame.
	const style = $derived(
		mergeStyles(
			position.style,
			view.transitionStatus === "starting" ? DISABLED_TRANSITIONS_STYLE : undefined,
		),
	);
	// What reaches the element: the user's props without the placement props.
	const elementProps: PartUserProps<State> = $derived.by(() => {
		const {
			anchor: _anchor,
			positionMethod: _positionMethod,
			side: _side,
			sideOffset: _sideOffset,
			align: _align,
			alignOffset: _alignOffset,
			collisionBoundary: _collisionBoundary,
			collisionPadding: _collisionPadding,
			sticky: _sticky,
			arrowPadding: _arrowPadding,
			disableAnchorTracking: _disableAnchorTracking,
			collisionAvoidance: _collisionAvoidance,
			...rest
		} = user;
		return rest;
	});

	const attachPositioner = attachRef<HTMLElement>(
		(element) => view.setPositionerElement(element),
		() => view.positionerElement as HTMLElement | null,
	);
</script>

{#if backdrop}
	<!-- The internal backdrop of a modal popup, with the trigger cut out so it stays pressable. -->
	<div
		role="presentation"
		{...{ [INERT_MARKER]: "" }}
		inert={!view.open}
		style={position.backdropStyle}
	></div>
{/if}
<Part
	tag="div"
	bind:ref
	{state}
	{attrs}
	role="presentation"
	hidden={!view.mounted}
	{style}
	{@attach attachPositioner}
	{@attach attachPositionerClaim}
	{@attach position.attach}
	user={elementProps}
/>
