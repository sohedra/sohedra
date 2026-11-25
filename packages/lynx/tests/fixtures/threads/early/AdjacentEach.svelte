<!--
	Two {#each}s beside each other: a row moves from one to the other between the threads.
-->
<script lang="ts">
	let { a, b, log }: { a: string[]; b: string[]; log: unknown[] } = $props();
</script>

<view class="box">
	{#each a as item (item)}<text class="row" ontap={() => log.push(`unpin ${item}`)}>{item}</text
		>{/each}
	{#each b as item (item)}<text class="row" ontap={() => log.push(`pin ${item}`)}>{item}</text
		>{/each}
</view>
