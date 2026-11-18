<script lang="ts">
	import { background } from "@sohedra/lynx/env";

	import FrameLabeled from "./FrameLabeled.svelte";

	let { async = true }: { async?: boolean } = $props();
</script>

<FrameLabeled />
<list class="list" custom-list-name={async ? "list-container" : undefined}>
	{#each ["a", "b"] as row (row)}
		<list-item item-key={row} defer>
			{#if background}<FrameLabeled />{/if}
			<FrameLabeled />
		</list-item>
	{/each}
</list>
<FrameLabeled />
