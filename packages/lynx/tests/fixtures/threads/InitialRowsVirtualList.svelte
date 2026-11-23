<script lang="ts">
	import type { Snippet } from "svelte";

	// A list component that renders each of its items through the row snippet it is given.
	let { items, row }: { items: number[]; row: Snippet<[number]> } = $props();
</script>

<list class="list" custom-list-name="list-container">
	{#each items as item (item)}
		{@render row(item)}
	{/each}
</list>
