<script lang="ts">
	let groups = $state([{ id: 1, items: ["one"] }]);
</script>

<list class="outer">
	{#each groups as group (group.id)}
		<list-item>
			<list class="inner inner-{group.id}">
				{#each group.items as item (item)}
					<list-item><text>{item}</text></list-item>
				{/each}
			</list>
		</list-item>
	{/each}
</list>
<view class="add" ontap={() => groups.push({ id: 2, items: ["inner-1", "inner-2", "inner-3"] })}>
	<text>add</text>
</view>
<view class="grow" ontap={() => groups[1]?.items.push("inner-4")}><text>grow</text></view>
