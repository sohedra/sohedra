<!--
  Places a Popover part within a Root that is open unless the props say `open: false`, for
  `triggerId` from the first render (also on the server). `withTrigger` adds that trigger beside
  the part; `ignoreOutsidePress` cancels closing on an outside press.
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
