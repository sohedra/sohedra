<script lang="ts">
	let { rows, mark = "" }: { rows: string[]; mark?: string } = $props();
</script>

<list class="outer" custom-list-name="list-container">
	<list-item item-key="holder">
		<list class="inner" custom-list-name="list-container">
			{#each rows as row (row)}
				<list-item item-key={row} defer><text class="row {mark}">{row}</text></list-item>
			{/each}
		</list>
	</list-item>
	{#each rows as row (row)}
		<list-item item-key="outer-{row}" defer><text class="outer-row {mark}">{row}</text></list-item>
	{/each}
</list>
