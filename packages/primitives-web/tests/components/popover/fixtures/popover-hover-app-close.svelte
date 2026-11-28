<!--
  A hover-opening popover whose open state the parent owns (`bind:open`). The button inside the
  popup closes it the way an app does, by setting `open` itself; `setOpen` does the same from the
  test. `onOpenChange` hears every change the popover reports.
-->
<script lang="ts">
	import { Popover } from "#lib/components/popover/index.js";
	import type {
		PopoverRootChangeEventDetails,
		PopoverTriggerProps,
	} from "#lib/components/popover/popover-types.js";

	let {
		triggerProps = {},
		keepMounted = false,
		onOpenChange,
	}: {
		triggerProps?: Partial<PopoverTriggerProps>;
		keepMounted?: boolean;
		onOpenChange?: (open: boolean, details: PopoverRootChangeEventDetails) => void;
	} = $props();

	let open = $state(false);

	export function setOpen(next: boolean) {
		open = next;
	}
</script>

<Popover.Root bind:open {onOpenChange}>
	<Popover.Trigger openOnHover {...triggerProps}>Trigger</Popover.Trigger>
	<Popover.Portal {keepMounted}>
		<Popover.Positioner data-testid="positioner">
			<Popover.Popup data-testid="popup">
				<button type="button" onclick={() => (open = false)}>Done</button>
			</Popover.Popup>
		</Popover.Positioner>
	</Popover.Portal>
</Popover.Root>
