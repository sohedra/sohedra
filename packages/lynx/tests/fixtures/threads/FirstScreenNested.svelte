<script lang="ts">
	// Deferred rows that each hold a list of deferred rows: each list counts its own first screen.
	let { outer = 12, inner = 5 }: { outer?: number; inner?: number } = $props();
	const range = (length: number) => Array.from({ length }, (_, index) => index + 1);
</script>

<list class="outer" custom-list-name="list-container">
	{#each range(outer) as row (row)}
		<list-item item-key="o{row}" defer>
			<text class="outer-{row}">Outer {row}</text>
			<list class="inner-{row}" custom-list-name="list-container" initial-item-count={3}>
				{#each range(inner) as cell (cell)}
					<list-item item-key="i{cell}" defer>
						<text class="inner-{row}-{cell}">Inner {cell}</text>
					</list-item>
				{/each}
			</list>
		</list-item>
	{/each}
</list>
