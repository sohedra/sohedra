<!--
  @component
  A viewport for displaying content transitions. Renders a `<div>` element.
-->
<script lang="ts">
	import { AnchoredViewport } from "../../foundation/position/index.js";
	import { popoverViewportAttributes } from "./popover-attributes.js";
	import { PopoverPositionerContext, PopoverRootContext } from "./popover-context.js";
	import type { PopoverViewportProps } from "./popover-types.js";

	// 1. Props
	let { ref = $bindable(null), ...rest }: PopoverViewportProps = $props();

	// 2. Store and context
	const popover = PopoverRootContext.get("Popover.Viewport");
	const positioner = PopoverPositionerContext.get("Popover.Viewport");
</script>

<AnchoredViewport
	bind:ref
	part="Popover.Viewport"
	popup={popover}
	side={positioner.side}
	instant={popover.instantType}
	attrs={popoverViewportAttributes}
	user={rest}
/>
