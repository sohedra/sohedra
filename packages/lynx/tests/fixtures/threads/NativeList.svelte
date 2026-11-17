<script lang="ts">
	let { handles }: { handles: Record<string, unknown> } = $props();
	const feed = $state({ rows: ["a", "b", "c"], suffix: "", sticky: false, show: true, tapped: "" });
	handles["feed"] = feed;
</script>

{#if feed.show}
	<list class="list">
		{#each feed.rows as row (row)}
			<list-item reuse-identifier="row" sticky-top={feed.sticky}>
				<text ontap={() => (feed.tapped = row)}>{row}{feed.suffix}</text>
			</list-item>
		{/each}
	</list>
{/if}
