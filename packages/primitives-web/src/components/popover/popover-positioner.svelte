<!--
  @component
  Positions the popover against the trigger. Renders a `<div>` element.
-->
<script lang="ts">
	import { sohedraId } from "@sohedra/primitives-core/foundation/kernel/index.js";
	import { POPUP_BEHAVIOR } from "@sohedra/primitives-core/foundation/popup/index.js";

	import { usePopupPositioner } from "../../foundation/popup/index.js";
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

	// 3. Shared behaviours
	// The shared Positioner part below places the popup. Beside it: the popover's node in the
	// popup tree, transitions that run again when it moves to another trigger, and the page
	// scroll lock of a modal popover.
	usePopupPositioner(popover, () => ({ nodeId: sohedraId(uid) }));
</script>

<AnchoredPositioner
	bind:ref
	popup={popover}
	context={PopoverPositionerContext}
	keepMounted={portal.keepMounted}
	instant={popover.instantType}
	attrs={popoverPositionerAttributes}
	defaultSide={POPUP_BEHAVIOR.popover.side}
	backdrop={popover.internalBackdropMounted}
	user={rest}
/>
