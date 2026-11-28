<!--
  @component
  Positions the popover against the trigger. Renders a `<div>` element.
-->
<script lang="ts">
	import { sohedraId } from "@sohedra/primitives-core/foundation/kernel/index.js";
	import { POPUP_BEHAVIOR } from "@sohedra/primitives-core/foundation/popup/index.js";

	import { AnchoredPositioner } from "../../foundation/position/index.js";
	import { popoverPositionerAttributes } from "./popover-attributes.js";
	import {
		PopoverPortalContext,
		PopoverPositionerContext,
		PopoverRootContext,
	} from "./popover-context.js";
	import type { PopoverPositionerProps } from "./popover-types.js";

	// 1. Props
	let { ref = $bindable(null), ...rest }: PopoverPositionerProps = $props();

	const uid = $props.id();

	// 2. Store and context
	const popover = PopoverRootContext.get("Popover.Positioner");
	const portal = PopoverPortalContext.get("Popover.Positioner");
</script>

<AnchoredPositioner
	bind:ref
	popup={popover}
	nodeId={sohedraId(uid)}
	context={PopoverPositionerContext}
	keepMounted={portal.keepMounted}
	attrs={popoverPositionerAttributes}
	defaultSide={POPUP_BEHAVIOR.popover.side}
	backdrop={popover.internalBackdropMounted}
	user={rest}
/>
