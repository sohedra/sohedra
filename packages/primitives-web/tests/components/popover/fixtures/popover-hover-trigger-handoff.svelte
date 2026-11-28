<!--
  Two hover-opening triggers of one popover, "A" and "B", and a popup that shows the payload of
  the trigger it belongs to. `onOpenChange` hears every change the popover reports.
-->
<script lang="ts">
	import { Popover } from "#lib/components/popover/index.js";
	import type {
		PopoverRootChangeEventDetails,
		PopoverTriggerProps,
	} from "#lib/components/popover/popover-types.js";

	let {
		triggerProps = {},
		onOpenChange,
	}: {
		triggerProps?: Partial<PopoverTriggerProps>;
		onOpenChange?: (open: boolean, details: PopoverRootChangeEventDetails) => void;
	} = $props();
</script>

<Popover.Root {onOpenChange}>
	{#snippet children({ payload })}
		<Popover.Trigger payload="A" openOnHover {...triggerProps}>A</Popover.Trigger>
		<Popover.Trigger payload="B" openOnHover {...triggerProps}>B</Popover.Trigger>
		<Popover.Portal>
			<Popover.Positioner data-testid="positioner">
				<Popover.Popup data-testid="popup">Details for {payload as string}</Popover.Popup>
			</Popover.Positioner>
		</Popover.Portal>
	{/snippet}
</Popover.Root>
