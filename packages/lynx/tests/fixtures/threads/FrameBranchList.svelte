<script lang="ts">
	import { background } from "@sohedra/lynx/environment";

	let { rows = ["a", "b", "c"] }: { rows?: string[] } = $props();
</script>

{#if background}
	<list class="list">
		{#each rows as row (row)}
			<list-item item-key={row} class="row"><text class="label">{row}</text></list-item>
		{/each}
	</list>
{:else}
	<list class="list">
		{#each rows as row (row)}
			<list-item item-key={row} class="row drawn"><text class="label drawn">{row}</text></list-item>
		{/each}
	</list>
{/if}
