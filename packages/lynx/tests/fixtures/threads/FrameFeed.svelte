<script lang="ts">
	let { handles = {} }: { handles?: Record<string, unknown> } = $props();
	const feed = $state({ rows: [{ id: 1, cards: ["one", "two"] }], tapped: "" });
	handles["feed"] = feed;
</script>

<list class="feed">
	{#each feed.rows as row (row.id)}
		<list-item item-key={`row-${row.id}`}>
			<list class="carousel" scroll-orientation="horizontal">
				{#each row.cards as card (card)}
					<list-item item-key={card}>
						<text class="card" ontap={() => (feed.tapped = card)}>{card}</text>
					</list-item>
				{/each}
			</list>
		</list-item>
	{/each}
</list>
