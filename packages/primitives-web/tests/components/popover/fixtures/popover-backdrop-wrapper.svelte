<!--
  A part-root-wrapper for Popover.Backdrop: a press on the backdrop is a press outside the popup,
  which would close the popover and hide the backdrop, so the wrapper cancels it.
-->
<script lang="ts">
	import type { Snippet } from "svelte";

	import PartRootWrapper from "./popover-root-wrapper.svelte";

	let { children, partProps }: { children: Snippet; partProps: Record<string, unknown> } = $props();
</script>

<PartRootWrapper {partProps} ignoreOutsidePress>{@render children()}</PartRootWrapper>
