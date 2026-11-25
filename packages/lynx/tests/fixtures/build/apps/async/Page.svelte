<!-- A component that awaits, in a boundary whose pending snippet the first frame draws, and an
`{#await}` block, whose pending branch it draws. -->
<script lang="ts">
	import Doubled from "./Doubled.svelte";

	const word = Promise.resolve("ready");
</script>

<view class="page">
	<svelte:boundary>
		<Doubled />
		{#snippet pending()}<text class="pending">Loading</text>{/snippet}
	</svelte:boundary>
	{#await word}<text class="waiting">Waiting</text>{:then value}<text class="word">{value}</text
		>{/await}
</view>
