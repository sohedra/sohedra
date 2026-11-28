<!--
  The conformance wrapper of the parts that live in the positioned popup (Popup, Arrow, Viewport):
  places the part within Root > Portal > Positioner (and Popup with `inPopup`). The Root is open unless the part's props
  say `open: false`, for its trigger from the first render (so the server renders the trigger
  as the client does); the Portal is kept mounted so a closed part stays in the DOM.
-->
<script lang="ts">
	import type { Snippet } from "svelte";

	import { Popover } from "#lib/components/popover/index.js";

	let {
		children,
		partProps,
		inPopup = false,
	}: { children: Snippet; partProps: Record<string, unknown>; inPopup?: boolean } = $props();
</script>

<Popover.Root open={partProps.open !== false} triggerId="wrapper-trigger">
	<Popover.Trigger id="wrapper-trigger">Trigger</Popover.Trigger>
	<Popover.Portal keepMounted>
		<Popover.Positioner>
			{#if inPopup}
				<Popover.Popup>{@render children()}</Popover.Popup>
			{:else}
				{@render children()}
			{/if}
		</Popover.Positioner>
	</Popover.Portal>
</Popover.Root>
