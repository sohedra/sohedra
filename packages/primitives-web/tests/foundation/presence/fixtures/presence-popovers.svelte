<!--
  Popovers for the animation-finished cases: `first` and, with `second`, a second Popover, each with
  a bindable `open` and `onOpenChangeComplete`. A closing Popover unmounts its popup (`popup-1`,
  `popup-2`) once the popup's animations finish. With `reopenSecond`, the first popover's close
  completion opens the second.
-->
<script lang="ts">
	import { Popover } from "#lib/components/popover/index.js";

	let {
		firstOpen = $bindable(true),
		secondOpen = $bindable(true),
		second = false,
		reopenSecond = false,
		onFirstComplete,
		onSecondComplete,
	}: {
		firstOpen?: boolean;
		secondOpen?: boolean;
		second?: boolean;
		reopenSecond?: boolean;
		onFirstComplete?: (open: boolean) => void;
		onSecondComplete?: (open: boolean) => void;
	} = $props();

	function firstComplete(open: boolean) {
		onFirstComplete?.(open);
		if (!open && reopenSecond) {
			secondOpen = true;
		}
	}
</script>

<Popover.Root bind:open={firstOpen} onOpenChangeComplete={firstComplete}>
	<Popover.Trigger>First</Popover.Trigger>
	<Popover.Portal>
		<Popover.Positioner>
			<Popover.Popup data-testid="popup-1">First popup</Popover.Popup>
		</Popover.Positioner>
	</Popover.Portal>
</Popover.Root>

{#if second}
	<Popover.Root bind:open={secondOpen} onOpenChangeComplete={onSecondComplete}>
		<Popover.Trigger>Second</Popover.Trigger>
		<Popover.Portal>
			<Popover.Positioner>
				<Popover.Popup data-testid="popup-2">Second popup</Popover.Popup>
			</Popover.Positioner>
		</Popover.Portal>
	</Popover.Root>
{/if}
