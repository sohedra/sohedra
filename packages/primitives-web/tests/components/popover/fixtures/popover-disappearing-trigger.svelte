<!--
  A Root whose only trigger is removed as soon as the popover opens, beside a "Focus fallback"
  button: the demo's triggers stay.
-->
<script lang="ts">
	import { Popover } from "#lib/components/popover/index.js";

	let open = $state(false);
	let showTrigger = $state(true);
</script>

<!-- tabindex: WebKit's Tab skips buttons otherwise. -->
<button type="button" tabindex="0">Focus fallback</button>

<Popover.Root
	{open}
	onOpenChange={(nextOpen) => {
		if (nextOpen) {
			showTrigger = false;
		}
		open = nextOpen;
	}}
>
	{#if showTrigger}
		<Popover.Trigger onmousedown={(event) => event.preventDefault()}>
			Disappearing trigger
		</Popover.Trigger>
	{/if}

	<Popover.Portal>
		<Popover.Positioner>
			<Popover.Popup>
				<span data-testid="content">Content</span>
				<Popover.Close>Close</Popover.Close>
			</Popover.Popup>
		</Popover.Positioner>
	</Popover.Portal>
</Popover.Root>
