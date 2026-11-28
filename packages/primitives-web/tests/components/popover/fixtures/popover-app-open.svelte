<!--
  A hover-opening popover whose open state the app owns (`bind:open`), which the demo can't express:
  "Done" and `setOpen` set `open` as an app does, not through a close the popover reports. With
  `detached`, "Trigger 1" (hover) and "Trigger 2" (press) sit outside the Root on `handle`.
-->
<script lang="ts">
	import { Popover } from "#lib/components/popover/index.js";
	import type {
		PopoverHandle,
		PopoverRootChangeEventDetails,
		PopoverTriggerProps,
	} from "#lib/components/popover/popover-types.js";

	let {
		triggerProps = {},
		keepMounted = false,
		detached = false,
		handle,
		onOpenChange,
	}: {
		triggerProps?: Partial<PopoverTriggerProps>;
		keepMounted?: boolean;
		detached?: boolean;
		handle?: PopoverHandle;
		onOpenChange?: (open: boolean, details: PopoverRootChangeEventDetails) => void;
	} = $props();

	let open = $state(false);

	export function setOpen(next: boolean) {
		open = next;
	}
</script>

{#if detached}
	<Popover.Trigger {handle} id="trigger-1" openOnHover delay={0}>Trigger 1</Popover.Trigger>
	<Popover.Trigger {handle} id="trigger-2">Trigger 2</Popover.Trigger>
{/if}
<Popover.Root handle={detached ? handle : undefined} bind:open {onOpenChange}>
	{#if !detached}
		<Popover.Trigger openOnHover {...triggerProps}>Trigger</Popover.Trigger>
	{/if}
	<Popover.Portal {keepMounted}>
		<Popover.Positioner data-testid="positioner">
			<Popover.Popup data-testid="popup">
				{#if !detached}
					<button type="button" onclick={() => (open = false)}>Done</button>
				{/if}
			</Popover.Popup>
		</Popover.Positioner>
	</Popover.Portal>
</Popover.Root>
