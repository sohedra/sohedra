<script lang="ts">
	let count = $state(0);
</script>

<view class="root" style="padding: 24px;">
	<text class="count">Taps: {count} ({count % 2 === 0 ? "even" : "odd"})</text>
	{#if count >= 3}
		<text class="many">Three or more</text>
	{/if}
	<view class="button" ontap={() => count++}><text>Tap me</text></view>
</view>
