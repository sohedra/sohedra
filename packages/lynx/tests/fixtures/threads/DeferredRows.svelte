<script lang="ts">
	import DeferredRow from "./DeferredRow.svelte";

	let {
		handles,
		count = 40,
		async = true,
		defer = true,
		preload,
	}: {
		handles: Record<string, unknown>;
		count?: number;
		async?: boolean;
		defer?: boolean | { unmountRecycled?: boolean };
		preload?: number;
	} = $props();
	const feed = $state({
		rows: Array.from({ length: count }, (_, index) => ({
			id: index + 1,
			label: `Row ${index + 1}`,
		})),
		show: true,
	});
	handles["feed"] = feed;
	handles["rendered"] ??= [];
	handles["unmounted"] ??= [];
</script>

{#if feed.show}
	<list
		class="list"
		custom-list-name={async ? "list-container" : undefined}
		preload-buffer-count={preload}
	>
		{#each feed.rows as row (row.id)}
			<list-item item-key="r{row.id}" {defer}>
				<DeferredRow {row} {handles} />
			</list-item>
		{/each}
	</list>
{/if}
