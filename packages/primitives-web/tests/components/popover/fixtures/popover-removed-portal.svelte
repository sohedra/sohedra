<!-- A popover whose Portal a button inside it removes while the Root stays open. -->
<script lang="ts">
	import { Popover } from "#lib/components/popover/index.js";

	let { onOpenChangeComplete }: { onOpenChangeComplete?: (open: boolean) => void } = $props();

	let shown = $state(true);
</script>

<Popover.Root {onOpenChangeComplete}>
	<Popover.Trigger>Toggle</Popover.Trigger>
	{#if shown}
		<Popover.Portal>
			<Popover.Positioner>
				<Popover.Popup data-testid="popup">
					<button onclick={() => (shown = false)}>Remove</button>
				</Popover.Popup>
			</Popover.Positioner>
		</Popover.Portal>
	{/if}
</Popover.Root>
