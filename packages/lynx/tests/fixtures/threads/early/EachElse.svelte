<!--
	An {#each} with an {:else}: the first frame may draw the {:else}, and the background a row.
-->
<script lang="ts">
	let { items, log }: { items: string[]; log: unknown[] } = $props();
</script>

<view>
	{#each items as item (item)}
		<text class="row" ontap={() => log.push(`open ${item}`)}>{item}</text>
	{:else}
		<text class="empty" ontap={() => log.push("add the first")}>Add</text>
	{/each}
</view>
