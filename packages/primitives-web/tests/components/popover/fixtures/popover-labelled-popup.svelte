<!--
  The Popover.Title / Popover.Description test tree: an open popover whose popup holds a
  Popover.Title or a Popover.Description.
-->
<script lang="ts">
	import { Popover } from "#lib/components/popover/index.js";

	let { part }: { part: "title" | "description" } = $props();
</script>

<Popover.Root open>
	<Popover.Trigger>Trigger</Popover.Trigger>
	<Popover.Portal>
		<Popover.Positioner>
			<Popover.Popup>
				{#if part === "title"}
					<Popover.Title>Title</Popover.Title>
				{:else}
					<Popover.Description>Title</Popover.Description>
				{/if}
			</Popover.Popup>
		</Popover.Positioner>
	</Popover.Portal>
</Popover.Root>
