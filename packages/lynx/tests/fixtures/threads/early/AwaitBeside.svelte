<!--
	An {#await} given a promise beside an {#if}, with the same data on both threads: the background
	draws the {#await}'s content after the rest of the page.
-->
<script lang="ts">
	let { log }: { log: unknown[] } = $props();
	const shown = true;
	const promise = new Promise<string>(() => {});
</script>

<view>
	{#if shown}
		<text class="beside" ontap={() => log.push("beside")}>beside</text>
	{/if}
	{#await promise}
		<text class="wait" ontap={() => log.push("wait")}>wait</text>
	{:then value}
		<text>{value}</text>
	{/await}
</view>
