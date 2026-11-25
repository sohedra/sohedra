<!-- An `{#await}` block without Svelte's async mode: the first frame draws its pending branch. -->
<script lang="ts">
	const word = Promise.resolve("ready");
</script>

<view class="page">
	{#await word}<text class="waiting">Waiting</text>{:then value}<text class="word">{value}</text
		>{/await}
</view>
