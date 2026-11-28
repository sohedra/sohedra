<!--
  A hover-enabled popover whose Root is removed by `show = false`. With `detached`, the trigger
  sits outside the Root (through a handle) and survives the Root's removal.
-->
<script lang="ts">
	import { Popover } from "#lib/components/popover/index.js";
	import type {
		PopoverRootProps,
		PopoverTriggerProps,
	} from "#lib/components/popover/popover-types.js";

	let {
		show = true,
		detached = false,
		rootProps = {},
		triggerProps = {},
	}: {
		show?: boolean;
		detached?: boolean;
		rootProps?: Partial<PopoverRootProps>;
		triggerProps?: Partial<PopoverTriggerProps>;
	} = $props();

	const handle = Popover.createHandle();
</script>

{#if detached}
	<Popover.Trigger {handle} {...triggerProps}>Trigger</Popover.Trigger>
{/if}
{#if show}
	<Popover.Root handle={detached ? handle : undefined} {...rootProps}>
		{#if !detached}
			<Popover.Trigger {...triggerProps}>Trigger</Popover.Trigger>
		{/if}
		<Popover.Portal>
			<Popover.Positioner>
				<Popover.Popup>Content</Popover.Popup>
			</Popover.Positioner>
		</Popover.Portal>
	</Popover.Root>
{/if}
