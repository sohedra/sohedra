<!-- An awaited promise that rejects, in a boundary with a pending and a failed snippet. -->
<script lang="ts">
	const load = (): Promise<string> => Promise.reject(new Error("not found"));
</script>

<view class="page">
	<svelte:boundary>
		<text class="value">{await load()}</text>
		{#snippet pending()}<text class="pending">Loading</text>{/snippet}
		{#snippet failed(error)}<text class="failed">Failed: {(error as Error).message}</text>{/snippet}
	</svelte:boundary>
</view>
