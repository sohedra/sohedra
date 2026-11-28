<!--
  The Popover.Backdrop pointer-events tree: an `openOnHover` trigger (with `delay`) and a
  backdrop in the portal beside the positioner.
-->
<script lang="ts">
	import { Popover } from "#lib/components/popover/index.js";

	let { delay }: { delay?: number } = $props();
</script>

<Popover.Root>
	<Popover.Trigger {delay} openOnHover>Open</Popover.Trigger>
	<Popover.Portal>
		<Popover.Backdrop data-testid="backdrop" />
		<Popover.Positioner>
			<Popover.Popup />
		</Popover.Positioner>
	</Popover.Portal>
</Popover.Root>
