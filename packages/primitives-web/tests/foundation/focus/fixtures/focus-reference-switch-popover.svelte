<!--
  The tree of "does not return focus while open when the reference changes": a Popover with two
  triggers (`first`, `second`), where the Root's `triggerId` picks the reference while the popup
  is open. The popup holds a `child` button and a `close` button.
-->
<script lang="ts">
	import { Popover } from "#lib/components/popover/index.js";

	let { triggerId }: { triggerId?: string | null } = $props();
</script>

<Popover.Root {triggerId}>
	<Popover.Trigger id="first" data-testid="first">first</Popover.Trigger>
	<Popover.Trigger id="second" data-testid="second">second</Popover.Trigger>
	<Popover.Portal>
		<Popover.Positioner>
			<Popover.Popup>
				<button data-testid="child">child</button>
				<Popover.Close data-testid="close">close</Popover.Close>
			</Popover.Popup>
		</Popover.Positioner>
	</Popover.Portal>
</Popover.Root>
