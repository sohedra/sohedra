<!--
  The detached-triggers fixture with its open state and active trigger in the parent, which
  `onOpenChange` updates; buttons above the triggers (so the popup never covers them) open it for
  a trigger or close it.
-->
<script lang="ts">
	import type { ComponentProps } from "svelte";

	import ConformanceDetachedTriggers from "./conformance-detached-triggers.svelte";

	let props: Omit<
		ComponentProps<typeof ConformanceDetachedTriggers>,
		"rootProps" | "positionerProps"
	> = $props();

	let open = $state(false);
	let triggerId: string | null = $state(null);

	function onOpenChange(nextOpen: boolean, details: { trigger: Element | undefined }) {
		triggerId = details.trigger?.id ?? null;
		open = nextOpen;
	}
</script>

<div style="margin: 50px">
	<button
		type="button"
		onclick={() => {
			open = true;
			triggerId = "trigger-1";
		}}
	>
		Open Trigger 1
	</button>
	<button
		type="button"
		onclick={() => {
			open = true;
			triggerId = "trigger-2";
		}}
	>
		Open Trigger 2
	</button>
	<button type="button" onclick={() => (open = false)}>Close externally</button>
	<ConformanceDetachedTriggers
		{...props}
		rootProps={{ open, triggerId, onOpenChange }}
		positionerProps={{ side: "bottom", align: "start" }}
	/>
</div>
