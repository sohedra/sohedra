<!--
	Rows of an {#each} between two {#if}s: a header and a footer.
-->
<script lang="ts">
	let { rows, header = true, log }: { rows: string[]; header?: boolean; log: unknown[] } = $props();
</script>

<view class="box">
	{#if header}<text class="s-header" ontap={() => log.push("s-header")}>x</text>{/if}
	{#each rows as row (row)}<text class="s-row" ontap={() => log.push("s-row")}>x</text>{/each}
	{#if header}<text class="s-footer" ontap={() => log.push("s-footer")}>x</text>{/if}
</view>
