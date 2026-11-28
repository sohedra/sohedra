<!-- Two detached triggers, a span after them, and a Root with a Close button. -->
<script lang="ts">
	import { Popover } from "#lib/components/popover/index.js";
	import type { PopoverHandle, PopoverRootProps } from "#lib/components/popover/popover-types.js";

	let {
		handle,
		onOpenChange,
	}: { handle: PopoverHandle; onOpenChange: PopoverRootProps["onOpenChange"] } = $props();
</script>

<Popover.Trigger {handle} id="trigger-1">Trigger 1</Popover.Trigger>
<Popover.Trigger {handle} id="trigger-2">Trigger 2</Popover.Trigger>
<span>After</span>
<Popover.Root {handle} {onOpenChange}>
	<Popover.Portal>
		<Popover.Positioner>
			<Popover.Popup>
				Content
				<Popover.Close>Close</Popover.Close>
			</Popover.Popup>
		</Popover.Positioner>
	</Popover.Portal>
</Popover.Root>
