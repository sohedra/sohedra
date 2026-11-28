<!--
  Two popovers, each with its own handle and Root (`onOpenChange` hears the first, `onOpenChange2`
  the second), and one detached hover trigger on the handle `which` names. `showTrigger: false`
  removes the trigger.
-->
<script lang="ts">
	import { Popover } from "#lib/components/popover/index.js";
	import type {
		PopoverRootChangeEventDetails,
		PopoverTriggerProps,
	} from "#lib/components/popover/popover-types.js";

	let {
		which = 1,
		showTrigger = true,
		triggerProps = {},
		onOpenChange,
		onOpenChange2,
	}: {
		which?: 1 | 2;
		showTrigger?: boolean;
		triggerProps?: Partial<PopoverTriggerProps>;
		onOpenChange?: (open: boolean, details: PopoverRootChangeEventDetails) => void;
		onOpenChange2?: (open: boolean, details: PopoverRootChangeEventDetails) => void;
	} = $props();

	const first = Popover.createHandle();
	const second = Popover.createHandle();
</script>

{#if showTrigger}
	<Popover.Trigger handle={which === 1 ? first : second} {...triggerProps}>Trigger</Popover.Trigger>
{/if}
<Popover.Root handle={first} {onOpenChange}>
	<Popover.Portal>
		<Popover.Positioner>
			<Popover.Popup>First</Popover.Popup>
		</Popover.Positioner>
	</Popover.Portal>
</Popover.Root>
<Popover.Root handle={second} onOpenChange={onOpenChange2}>
	<Popover.Portal>
		<Popover.Positioner>
			<Popover.Popup>Second</Popover.Popup>
		</Popover.Positioner>
	</Popover.Portal>
</Popover.Root>
