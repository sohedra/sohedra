<!--
  The Arrow part of every anchored popup: an element its Positioner measures and places against
  the anchor. Renders a `<div>` element. A component's own Arrow file hands over its Positioner's
  state, its public state and its attribute mapping.
-->
<script lang="ts" generics="State extends object">
	import type { PositionerStore } from "@sohedra/primitives-core/foundation/position";

	import {
		attachRef,
		Part,
		type PartUserProps,
		type StateAttributesMapping,
		type WebTypes,
	} from "../kernel/index.js";
	import { arrowStyle } from "./position-positioner-style.js";

	interface Props {
		/** The component's Arrow state: its fields differ between components. */
		state: State;
		attrs: StateAttributesMapping<State>;
		/** The state of the Positioner the Arrow sits in. */
		positioner: PositionerStore<WebTypes>;
		ref?: HTMLDivElement | null | undefined;
		user: PartUserProps<State>;
	}

	let { state, attrs, positioner, ref = $bindable(null), user }: Props = $props();

	// The Positioner measures the arrow to place it against the anchor.
	const attachArrow = attachRef<HTMLElement>(
		(element) => positioner.setArrowElement(element),
		() => positioner.arrowElement as HTMLElement | null,
	);
</script>

<Part
	tag="div"
	bind:ref
	{state}
	{attrs}
	style={arrowStyle(positioner.position.arrow)}
	aria-hidden="true"
	{@attach attachArrow}
	{user}
/>
