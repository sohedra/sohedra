<!--
  Places a Popover part within a Popover.Root that is open unless the part's props say
  `open: false`. `triggerId` makes the
  root open for that trigger from the first render, also on the server (a trigger otherwise
  becomes the active one after mount). `withTrigger` adds a trigger with that id
  beside the part, so a part's effect on the open state can be read from it.
  `ignoreOutsidePress` cancels closing on a press outside the popup (such as on the backdrop).
-->
<script lang="ts">
	import type { Snippet } from "svelte";

	import { Popover } from "#lib/components/popover/index.js";
	import type { PopoverRootChangeEventDetails } from "#lib/components/popover/popover-types.js";

	let {
		children,
		partProps,
		withTrigger = false,
		triggerId,
		ignoreOutsidePress = false,
	}: {
		children: Snippet;
		partProps: Record<string, unknown>;
		withTrigger?: boolean;
		triggerId?: string;
		ignoreOutsidePress?: boolean;
	} = $props();

	const onOpenChange = (open: boolean, details: PopoverRootChangeEventDetails) => {
		if (ignoreOutsidePress && !open && details.reason === "outside-press") {
			details.cancel();
		}
	};
</script>

<Popover.Root open={partProps.open !== false} {triggerId} {onOpenChange}>
	{#if withTrigger}<Popover.Trigger id={triggerId} data-testid="wrapper-trigger"
			>Trigger</Popover.Trigger
		>{/if}
	{@render children()}
</Popover.Root>
