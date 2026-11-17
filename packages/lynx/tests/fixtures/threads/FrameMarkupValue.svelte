<script lang="ts">
	let { rows = ["a", "b"] }: { rows?: string[] } = $props();
</script>

<list class="list">
	{#each rows as row (row)}
		<list-item data-raw={{ markup: `<list-item>${row}</list-item></list>` }}>
			<text class="row">{row}</text>
		</list-item>
	{/each}
</list>
