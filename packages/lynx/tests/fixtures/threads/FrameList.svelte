<script lang="ts">
	let { rows, log }: { rows: string[]; log: unknown[] } = $props();
</script>

<list class="list">
	{#each rows as row (row)}
		<list-item reuse-identifier="row">
			<text class="row" ontap={() => log.push(row)}>{row}</text>
		</list-item>
	{/each}
</list>
