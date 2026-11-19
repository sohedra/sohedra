<script lang="ts">
	const items = [{ id: 1 }, { id: 2 }];
</script>

<list>
	{#each items as item (item)}
		<list-item><text>{item.id}</text></list-item>
	{/each}
</list>
