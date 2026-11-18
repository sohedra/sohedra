<script lang="ts">
	const rows = Array.from({ length: 30 }, (_, index) => index + 1);
</script>

<list class="outer">
	{#each rows as row (row)}
		<list-item item-key="o{row}">
			<list class="inner inner-{row}">
				{#each ["a", "b", "c"] as item (item)}
					<list-item item-key={item}><text>{row}{item}</text></list-item>
				{/each}
			</list>
		</list-item>
	{/each}
</list>
