<!--
  A popover whose Description sits inside a `<svelte:boundary>` and awaits `promise`, so it isn't
  in the document while the boundary shows its `pending` snippet. The Title is outside the
  boundary. The demo's Description is there from the start.
-->
<script lang="ts">
	import { Popover } from "#lib/components/popover/index.js";

	let { promise }: { promise: Promise<string> } = $props();
</script>

<Popover.Root>
	<Popover.Trigger data-testid="trigger">Open</Popover.Trigger>
	<Popover.Portal>
		<Popover.Positioner>
			<Popover.Popup data-testid="popup">
				<Popover.Title data-testid="title">Profile</Popover.Title>
				<svelte:boundary>
					<Popover.Description data-testid="description">{await promise}</Popover.Description>
					{#snippet pending()}
						<p data-testid="pending">Loading</p>
					{/snippet}
				</svelte:boundary>
			</Popover.Popup>
		</Popover.Positioner>
	</Popover.Portal>
</Popover.Root>
