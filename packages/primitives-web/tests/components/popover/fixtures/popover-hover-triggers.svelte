<!--
  Two hover-opening triggers of one popover carrying their `labels` as payloads, and a popup that
  shows its trigger's payload ("Details for <payload>"): the demo's triggers carry no payloads.
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
