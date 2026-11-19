<script lang="ts">
	let { handles }: { handles: Record<string, unknown> } = $props();
	const feed = $state({
		rows: Array.from({ length: 1000 }, (_, index) => ({
			id: index + 1,
			label: `Row ${index + 1}`,
		})),
	});
	handles["feed"] = feed;
</script>

<list class="list">
	{#each feed.rows as row (row.id)}
		<list-item>
			<view class="row"><text>{row.label}</text></view>
		</list-item>
	{/each}
</list>
