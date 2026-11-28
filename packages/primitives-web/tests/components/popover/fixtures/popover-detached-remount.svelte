<!--
  An open Root on trigger 0 whose whole tree remounts (a `{#key}`) and loses its conditional
  trigger 1 when "Toggle" is pressed.
-->
<script lang="ts">
	import { Popover } from "#lib/components/popover/index.js";
	import type { PopoverHandle } from "#lib/components/popover/popover-types.js";

	let { handle }: { handle: PopoverHandle } = $props();

	let key = $state(1);
	let showErrorDemo = $state(true);
</script>

{#key key}
	<button
		onclick={() => {
			showErrorDemo = !showErrorDemo;
			key += 1;
		}}
	>
		Toggle
	</button>
	<div
		style="display: flex; flex-direction: column; align-items: flex-start; gap: 48px; margin: 50px"
	>
		<Popover.Trigger {handle} id="trigger-0">Trigger 0</Popover.Trigger>
		{#if showErrorDemo}
			<Popover.Trigger {handle} id="trigger-1">Trigger 1</Popover.Trigger>
		{/if}
	</div>

	<Popover.Root {handle} triggerId="trigger-0" open>
		<Popover.Portal>
			<Popover.Positioner data-testid="positioner" sideOffset={4} align="start">
				<Popover.Popup>Content</Popover.Popup>
			</Popover.Positioner>
		</Popover.Portal>
	</Popover.Root>
{/key}
