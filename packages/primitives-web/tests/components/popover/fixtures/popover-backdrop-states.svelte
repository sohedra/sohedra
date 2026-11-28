<!--
  An initially open popover (`open` or `defaultOpen`) whose Backdrop reports every state it renders
  with, through a render snippet: the demo renders the Backdrop as it is.
-->
<script lang="ts">
	import { Popover } from "#lib/components/popover/index.js";
	import type { PopoverBackdropState } from "#lib/components/popover/popover-types.js";

	import PartStateRecorder from "./popover-state-recorder.svelte";

	let {
		controlled,
		onState,
	}: { controlled: boolean; onState: (state: PopoverBackdropState) => void } = $props();
</script>

<Popover.Root open={controlled ? true : undefined} defaultOpen={!controlled}>
	<Popover.Backdrop>
		{#snippet render({ props, state })}
			<div {...props}><PartStateRecorder {state} {onState} /></div>
		{/snippet}
	</Popover.Backdrop>
</Popover.Root>
