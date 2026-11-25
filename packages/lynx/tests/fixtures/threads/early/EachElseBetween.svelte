<!--
	A list's {:else} between two elements, with the same class on a row and on the empty state.
-->
<script lang="ts">
	let { items, log }: { items: string[]; log: unknown[] } = $props();
</script>

<view class="box">
	<text class="before" ontap={() => log.push("before")}>before</text>
	{#each items as item (item)}
		<text class="row" ontap={() => log.push(`open ${item}`)}>{item}</text>
	{:else}
		<text class="row" ontap={() => log.push("add the first")}>Add the first</text>
	{/each}
	<text class="after" ontap={() => log.push("after")}>after</text>
</view>
