<!--
	Rows of an {#each} before an {#if}.
-->
<script lang="ts">
	let { rows, log }: { rows: string[]; log: unknown[] } = $props();
	const shown = true;
</script>

<view class="box">
	{#each rows as row (row)}<text class="s-row">x</text>{/each}
	{#if shown}<text class="s-footer">x</text>{/if}
</view>
