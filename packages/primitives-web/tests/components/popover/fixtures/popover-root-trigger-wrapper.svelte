<!--
  A part-root-wrapper with a trigger beside the part (data-testid="wrapper-trigger"). The part
  sits outside any popup, so a click on it is an outside press: the wrapper cancels those, so
  only the part's own handler can close the popover.
-->
<script lang="ts">
	import type { Snippet } from "svelte";

	import PartRootWrapper from "./popover-root-wrapper.svelte";

	let { children, partProps }: { children: Snippet; partProps: Record<string, unknown> } = $props();
</script>

<PartRootWrapper {partProps} withTrigger triggerId="wrapper-trigger" ignoreOutsidePress
	>{@render children()}</PartRootWrapper
>
