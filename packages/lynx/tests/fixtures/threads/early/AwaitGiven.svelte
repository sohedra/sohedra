<!--
	An {#await} given a promise or a value, between two elements: its pending branch and its value
	look the same.
-->
<script lang="ts">
	let { given, log }: { given: unknown; log: unknown[] } = $props();
</script>

<view class="box">
	<text class="before" ontap={() => log.push("before")}>before</text>
	{#await given}
		<text class="item" ontap={() => log.push("pending")}>Loading</text>
	{:then value}
		<text class="item" ontap={() => log.push(`open ${value}`)}>{value}</text>
	{/await}
	<text class="after" ontap={() => log.push("after")}>after</text>
</view>
