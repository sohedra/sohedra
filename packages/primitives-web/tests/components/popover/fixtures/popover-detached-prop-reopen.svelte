<!--
  A detached hover trigger and a press trigger on a Root whose open state the parent owns
  (`bind:open`); `setOpen` changes it from the test.
-->
<script lang="ts">
	import { Popover } from "#lib/components/popover/index.js";
	import type { PopoverHandle } from "#lib/components/popover/popover-types.js";

	let { handle }: { handle: PopoverHandle } = $props();

	let open = $state(false);

	export function setOpen(next: boolean) {
		open = next;
	}
</script>

<div>
	<Popover.Trigger {handle} id="trigger-1" openOnHover delay={0}>Trigger 1</Popover.Trigger>
	<Popover.Trigger {handle} id="trigger-2">Trigger 2</Popover.Trigger>
	<Popover.Root {handle} bind:open>
		<Popover.Portal>
			<Popover.Positioner>
				<Popover.Popup data-testid="popup">Content</Popover.Popup>
			</Popover.Positioner>
		</Popover.Portal>
	</Popover.Root>
</div>
