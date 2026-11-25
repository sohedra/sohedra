<!--
	An {#await} given a value between two elements, whose rows only the background has.
-->
<script lang="ts">
	let { rows, log }: { rows: unknown; log: unknown[] } = $props();
</script>

<view class="box">
	<text class="s-before" ontap={() => log.push("s-before")}>x</text>
	{#await rows then xs}{#each xs as string[] as x (x)}<text
				class="s-row"
				ontap={() => log.push("s-row")}>x</text
			>{/each}{/await}
	<text class="s-after" ontap={() => log.push("s-after")}>x</text>
</view>
