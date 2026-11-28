<!-- An "Outside" button, a detached trigger and its Root. -->
<script lang="ts">
	import { Popover } from "#lib/components/popover/index.js";
	import type { PopoverHandle } from "#lib/components/popover/popover-types.js";

	let { handle }: { handle: PopoverHandle } = $props();
</script>

<button>Outside</button>
<Popover.Trigger {handle} id="trigger">Trigger</Popover.Trigger>
<Popover.Root {handle}>
	<Popover.Portal>
		<Popover.Positioner>
			<Popover.Popup data-testid="popup">Content</Popover.Popup>
		</Popover.Positioner>
	</Popover.Portal>
</Popover.Root>
