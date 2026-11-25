<!-- `FrameCounter.svelte` in an {#if}, for a first frame that took its other branch. -->
<script lang="ts">
	let count = $state(0);
	const shown = true;
</script>

{#if shown}
	<view class="root" style="padding: 24px;">
		<text class="count">Taps: {count} ({count % 2 === 0 ? "even" : "odd"})</text>
		<view class="button" ontap={() => count++}><text class="label">Tap me</text></view>
	</view>
{/if}
