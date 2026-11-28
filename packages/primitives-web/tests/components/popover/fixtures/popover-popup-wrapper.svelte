<!-- A part-positioner-wrapper with the part inside a Popover.Popup. -->
<script lang="ts">
	import type { Snippet } from "svelte";

	import PartPositionerWrapper from "./popover-positioner-wrapper.svelte";

	let { children, partProps }: { children: Snippet; partProps: Record<string, unknown> } = $props();
</script>

<PartPositionerWrapper {partProps} inPopup>{@render children()}</PartPositionerWrapper>
