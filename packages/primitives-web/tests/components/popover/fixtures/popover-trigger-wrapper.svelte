<!--
  A part-root-wrapper whose root is open for the trigger with id "conformance-trigger" (the
  part's id), so the trigger shows the open state from the server render on: a trigger otherwise
  becomes the active one only after mount.
-->
<script lang="ts">
	import type { Snippet } from "svelte";

	import PartRootWrapper from "./popover-root-wrapper.svelte";

	let { children, partProps }: { children: Snippet; partProps: Record<string, unknown> } = $props();
</script>

<PartRootWrapper {partProps} triggerId="conformance-trigger">{@render children()}</PartRootWrapper>
