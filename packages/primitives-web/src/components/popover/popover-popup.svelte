<!--
  @component
  A container for the popover contents. Renders a `<div>` element.
-->
<script lang="ts">
	import { popoverPopupState } from "@sohedra/primitives-core/components/popover/index.js";

	import { FOCUSABLE_POPUP_PROPS } from "../../foundation/focus/index.js";
	import { Part } from "../../foundation/kernel/index.js";
	import { usePopupElement } from "../../foundation/popup/index.js";
	import { popoverPopupAttributes } from "./popover-attributes.js";
	import {
		PopoverPopupContext,
		PopoverPositionerContext,
		PopoverRootContext,
	} from "./popover-context.js";
	import type { PopoverPopupProps } from "./popover-types.js";

	// 1. Props
	let { initialFocus, finalFocus, ref = $bindable(null), ...rest }: PopoverPopupProps = $props();

	// 2. Store and context
	const popover = PopoverRootContext.get("Popover.Popup");
	const positioner = PopoverPositionerContext.get("Popover.Popup");
	// A modal popover traps focus only with a Close part inside this Popup.
	PopoverPopupContext.set(popover);

	// 3. Shared behaviours
	const popup = usePopupElement(popover, () => ({
		id: rest.id as string | undefined,
		initialFocus,
		finalFocus,
	}));
</script>

<!-- The focus guards sit around the Popup's element, with no whitespace between them. -->
{#if popup.guarded}<span {...popup.guardBefore}></span>{/if}<Part
	tag="div"
	bind:ref
	state={popoverPopupState(popover, positioner)}
	attrs={popoverPopupAttributes}
	{...popup.props}
	id={popover.defaultPopupId}
	role="dialog"
	{...FOCUSABLE_POPUP_PROPS}
	aria-labelledby={popover.titleId.current}
	aria-describedby={popover.descriptionId.current}
	style={popup.style}
	user={rest}
/>{#if popup.guarded}<span {...popup.guardAfter}></span>{/if}
