<!--
	Rows of an {#each} after a fixed element, with no block in their parent.
-->
<script lang="ts">
	let { rows, log }: { rows: string[]; log: unknown[] } = $props();
</script>

<view class="box">
	<text class="s-header">x</text>
	{#each rows as row (row)}<text class="s-row">x</text>{/each}
</view>
