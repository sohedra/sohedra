<script lang="ts">
	import { background } from "@sohedra/lynx/env";

	import FrameLabeled from "./FrameLabeled.svelte";

	// No row among the initial rows unless `initial` says: every row waits to be asked for.
	let { async = true, initial = 0 }: { async?: boolean; initial?: number } = $props();
</script>

<FrameLabeled />
<list
	class="list"
	custom-list-name={async ? "list-container" : undefined}
	initial-item-count={initial}
>
	{#each ["a", "b"] as row (row)}
		<list-item item-key={row} defer>
			{#if background}<FrameLabeled />{/if}
			<FrameLabeled />
		</list-item>
	{/each}
</list>
<FrameLabeled />
