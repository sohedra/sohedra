<!--
  The popover the server-render tests render on the server and hydrate in the browser: a trigger
  and a portalled popup with a title and a description.
-->
<script lang="ts">
	import { Popover } from "#lib/components/popover/index.js";

	let { defaultOpen = false }: { defaultOpen?: boolean } = $props();
</script>

<Popover.Root {defaultOpen}>
	<Popover.Trigger data-testid="trigger">Toggle</Popover.Trigger>
	<Popover.Portal data-testid="portal">
		<Popover.Positioner data-testid="positioner">
			<Popover.Popup data-testid="popup">
				<Popover.Title>Title</Popover.Title>
				<Popover.Description>Description</Popover.Description>
			</Popover.Popup>
		</Popover.Positioner>
	</Popover.Portal>
</Popover.Root>
