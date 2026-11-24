<!--
	An await that a background timer settles, and `$effect.pending()`, which counts the awaits an
	update waits for while the page still shows the values before it.
-->
<script lang="ts">
	let count = $state(1);
	const later = (n: number): Promise<number> =>
		new Promise((resolve) => setTimeout(() => resolve(n * 2), 100));
</script>

<view class="page">
	<svelte:boundary>
		<text class="value">Doubled: {await later(count)}</text>
		<text class="waiting">Waiting for {$effect.pending()}</text>
		<view class="add" ontap={() => count++}><text>add</text></view>
		{#snippet pending()}<text class="pending">Loading</text>{/snippet}
	</svelte:boundary>
</view>
