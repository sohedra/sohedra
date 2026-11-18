<script lang="ts">
	const items = [{ id: 1 }];
</script>

<list>
	{#each items as item (item.id)}
		<list-item item-key={item}><text>{item.id}</text></list-item>
	{/each}
</list>
<view><text>ok</text></view>
