<!--
	Two {#await}s given values, each with rows: the rows move from one to the other between the
	threads.
-->
<script lang="ts">
	let { a, b, log }: { a: unknown; b: unknown; log: unknown[] } = $props();
</script>

<view class="box">
	{#await a then xs}{#each xs as string[] as x (x)}<text
				class="row"
				ontap={() => log.push(`a ${x}`)}>{x}</text
			>{/each}{/await}
	{#await b then ys}{#each ys as string[] as y (y)}<text
				class="row"
				ontap={() => log.push(`b ${y}`)}>{y}</text
			>{/each}{/await}
</view>
