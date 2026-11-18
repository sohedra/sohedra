<script lang="ts">
	import ReleasedRow from "./ReleasedRow.svelte";

	let {
		handles,
		count = 40,
		preload,
	}: { handles: Record<string, unknown>; count?: number; preload?: number } = $props();
	const feed = $state({
		rows: Array.from({ length: count }, (_, index) => ({
			id: index + 1,
			label: `Row ${index + 1}`,
		})),
		show: true,
		// The id of the row that is not recyclable, 0 for none.
		fixed: 0,
	});
	handles["feed"] = feed;
</script>

{#if feed.show}
	<list class="list" preload-buffer-count={preload}>
		{#each feed.rows as row (row.id)}
			<list-item item-key="r{row.id}" recyclable={row.id !== feed.fixed}>
				<ReleasedRow {row} {handles} />
			</list-item>
		{/each}
	</list>
{/if}
