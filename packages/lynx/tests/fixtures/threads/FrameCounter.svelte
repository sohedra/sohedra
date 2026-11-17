<script lang="ts">
	let { parity = "even" }: { parity?: string } = $props();
	let count = $state(0);
	let label = $derived(count === 0 ? parity : count % 2 === 0 ? "even" : "odd");
</script>

<view class="root" style="padding: 24px;">
	<text class="count">Taps: {count} ({label})</text>
	<view class="button" ontap={() => count++}><text class="label">Tap me</text></view>
</view>
