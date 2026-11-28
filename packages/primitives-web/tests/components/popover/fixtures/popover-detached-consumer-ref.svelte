<!-- A detached trigger whose `bind:ref` reports every value it is given to `onRef`. -->
<script lang="ts">
	import { Popover } from "#lib/components/popover/index.js";
	import type { PopoverHandle } from "#lib/components/popover/popover-types.js";

	let { handle, onRef }: { handle: PopoverHandle; onRef: (element: HTMLElement | null) => void } =
		$props();

	let ref: HTMLElement | null = $state(null);
</script>

<Popover.Trigger
	{handle}
	id="trigger"
	bind:ref={
		() => ref,
		(element) => {
			onRef(element ?? null);
			ref = element ?? null;
		}
	}>Trigger</Popover.Trigger
>
<Popover.Root {handle}>
	<Popover.Portal>
		<Popover.Positioner>
			<Popover.Popup>Content</Popover.Popup>
		</Popover.Positioner>
	</Popover.Portal>
</Popover.Root>
