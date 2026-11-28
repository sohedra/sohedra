<!--
  Type test (checked by `pnpm check`, never rendered): the payload type flows from the handle to
  Popover.Root's `children` snippet and to each trigger's `payload`.
-->
<script lang="ts">
	import { Popover } from "#lib/components/popover/index.js";

	const handle = Popover.createHandle<{ text: string }>();
	let root: Popover.Root.Actions | undefined = $state();
	let open = $state(false);

	function expectText(text: string | undefined): string | undefined {
		return text;
	}
</script>

<Popover.Trigger {handle} payload={{ text: "Trigger 1" }}>Trigger 1</Popover.Trigger>

<Popover.Root {handle} bind:this={root} bind:open>
	{#snippet children({ payload })}
		{expectText(payload?.text)}
	{/snippet}
</Popover.Root>
