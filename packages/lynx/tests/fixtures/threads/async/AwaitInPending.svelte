<!--
	An {#await} in the pending branch of another, each given what the page says.
-->
<script lang="ts">
	let { outer, inner, log }: { outer: unknown; inner: unknown; log: unknown[] } = $props();
</script>

<view class="box">
	<text class="s-before" ontap={() => log.push("s-before")}>before</text>
	{#await outer}
		<text class="s-outer-pending" ontap={() => log.push("s-outer-pending")}>outer pending</text>
		{#await inner}
			<text class="s-ipend" ontap={() => log.push("s-ipend")}>inner pending</text>
		{:then value}
			<text class="s-ithen" ontap={() => log.push("s-ithen")}>inner then</text>
		{/await}
		<text class="s-otail" ontap={() => log.push("s-otail")}>outer tail</text>
	{:then value}
		<text class="s-othen" ontap={() => log.push("s-othen")}>outer then</text>
	{/await}
	<text class="s-after" ontap={() => log.push("s-after")}>after</text>
</view>
