<!--
	Rows of an {#each} after an {#if}.
-->
<script lang="ts">
	let { rows, log }: { rows: string[]; log: unknown[] } = $props();
	const shown = true;
</script>

<view class="box">
	{#if shown}<text class="s-header">x</text>{/if}
	{#each rows as row (row)}<text class="s-row">x</text>{/each}
</view>
