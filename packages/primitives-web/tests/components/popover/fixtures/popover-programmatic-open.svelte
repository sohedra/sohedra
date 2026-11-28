<!--
  Two triggers inside a Root whose open state and active trigger the parent owns, and a button
  that opens it for trigger 2 without taking focus, which the demo cannot express.
-->
<script lang="ts">
	import { Popover } from "#lib/components/popover/index.js";

	let open = $state(false);
	let activeTrigger: string | null = $state(null);
</script>

<Popover.Root
	{open}
	triggerId={activeTrigger}
	onOpenChange={(nextOpen, details) => {
		activeTrigger = details.trigger?.id ?? null;
		open = nextOpen;
	}}
>
	<Popover.Trigger payload={1} id="trigger-1">Trigger 1</Popover.Trigger>
	<Popover.Trigger payload={2} id="trigger-2">Trigger 2</Popover.Trigger>

	<Popover.Portal>
		<Popover.Positioner>
			<Popover.Popup>
				<span data-testid="content">Content</span>
				<Popover.Close>Close</Popover.Close>
			</Popover.Popup>
		</Popover.Positioner>
	</Popover.Portal>
</Popover.Root>

<button
	onmousedown={(event) => event.preventDefault()}
	onclick={() => {
		open = true;
		activeTrigger = "trigger-2";
	}}
>
	Open Trigger 2 without focus
</button>
