<!--
  Three detached triggers and a Root (the "does not re-render inactive triggers" tree).
-->
<script lang="ts">
	import { Popover } from "#lib/components/popover/index.js";
	import type {
		PopoverHandle,
		PopoverRootProps,
		PopoverTriggerProps,
	} from "#lib/components/popover/popover-types.js";

	let {
		handle,
		rootProps = {},
		triggerProps = {},
		withClose = false,
	}: {
		handle: PopoverHandle;
		rootProps?: Partial<PopoverRootProps>;
		triggerProps?: Partial<PopoverTriggerProps>;
		withClose?: boolean;
	} = $props();
</script>

<div>
	<Popover.Trigger {handle} id="trigger-1" {...triggerProps}>Trigger 1</Popover.Trigger>
	<Popover.Trigger {handle} id="trigger-2" {...triggerProps}>Trigger 2</Popover.Trigger>
	<Popover.Trigger {handle} id="trigger-3" {...triggerProps}>Trigger 3</Popover.Trigger>
	<Popover.Root {handle} {...rootProps}>
		<Popover.Portal>
			<Popover.Positioner>
				<Popover.Popup data-testid="popup">
					Content
					{#if withClose}<Popover.Close>Close</Popover.Close>{/if}
				</Popover.Popup>
			</Popover.Positioner>
		</Popover.Portal>
	</Popover.Root>
</div>
