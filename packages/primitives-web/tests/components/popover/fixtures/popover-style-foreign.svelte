<!-- An open popover whose positioner offset the test changes, so its position style updates. -->
<script lang="ts">
	import { Popover } from "#lib/components/popover/index.js";

	let { sideOffset = 0 }: { sideOffset?: number } = $props();
</script>

<Popover.Root defaultOpen>
	<Popover.Trigger data-testid="trigger">Toggle</Popover.Trigger>
	<Popover.Portal>
		<Popover.Positioner data-testid="positioner" {sideOffset}>
			<Popover.Popup data-testid="popup">Content</Popover.Popup>
		</Popover.Positioner>
	</Popover.Portal>
</Popover.Root>
