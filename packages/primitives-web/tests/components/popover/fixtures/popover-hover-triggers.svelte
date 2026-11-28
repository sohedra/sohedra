<!--
  Two hover-opening triggers of one popover, named by `labels` and carrying them as payloads, and
  a popup that shows the payload of the trigger it belongs to: "Details for <payload>", the payload
  in `data-testid="content"`. The demo's triggers carry no payloads. `onOpenChange` hears every
  change the popover reports.
-->
<script lang="ts">
	import { Popover } from "#lib/components/popover/index.js";
	import type {
		PopoverRootChangeEventDetails,
		PopoverTriggerProps,
	} from "#lib/components/popover/popover-types.js";

	let {
		labels = ["A", "B"],
		triggerProps = { delay: 0, closeDelay: 0 },
		onOpenChange,
	}: {
		labels?: [string, string];
		triggerProps?: Partial<PopoverTriggerProps>;
		onOpenChange?: (open: boolean, details: PopoverRootChangeEventDetails) => void;
	} = $props();
</script>

<Popover.Root {onOpenChange}>
	{#snippet children({ payload })}
		{#each labels as label (label)}
			<Popover.Trigger payload={label} openOnHover {...triggerProps}>{label}</Popover.Trigger>
		{/each}
		<Popover.Portal>
			<Popover.Positioner data-testid="positioner">
				<Popover.Popup data-testid="popup"
					>Details for <span data-testid="content">{payload as string}</span></Popover.Popup
				>
			</Popover.Positioner>
		</Popover.Portal>
	{/snippet}
</Popover.Root>
