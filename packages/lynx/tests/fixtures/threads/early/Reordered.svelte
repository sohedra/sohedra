<!--
	Keyed rows the first frame and the background may draw in another order, with as many rows.
-->
<script lang="ts">
	let { items, same, log }: { items: string[]; same?: boolean; log: unknown[] } = $props();
</script>

<view>
	{#each items as item (item)}
		<text class="row" ontap={() => log.push(`delete ${item}`)}>{same ? "Delete" : item}</text>
	{/each}
</view>
