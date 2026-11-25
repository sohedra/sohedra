<!--
	An {#await} given a sequence expression, whose last value is what it is given.
-->
<script lang="ts">
	let { given, log }: { given: unknown; log: unknown[] } = $props();
</script>

<view class="box">
	{#await (log.push("read"), given)}
		<text class="item">Loading</text>
	{:then value}
		<text class="item">{value}</text>
	{/await}
</view>
