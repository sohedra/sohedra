<script lang="ts">
	// No row in either list's first screen unless `initial` says: every row waits to be asked for.
	let {
		rows,
		mark = "",
		initial = 0,
	}: { rows: string[]; mark?: string; initial?: number | null } = $props();
</script>

<list class="outer" custom-list-name="list-container" initial-item-count={initial}>
	<list-item item-key="holder">
		<list class="inner" custom-list-name="list-container" initial-item-count={initial}>
			{#each rows as row (row)}
				<list-item item-key={row} defer><text class="row {mark}">{row}</text></list-item>
			{/each}
		</list>
	</list-item>
	{#each rows as row (row)}
		<list-item item-key="outer-{row}" defer><text class="outer-row {mark}">{row}</text></list-item>
	{/each}
</list>
