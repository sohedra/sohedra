<!-- Awaits at the top of its script, then counts taps. -->
<script lang="ts">
	const start = await Promise.resolve(1);
	let count = $state(start);
</script>

<view class="counted">
	<text class="count">Count: {count}</text>
	<view class="add" ontap={() => count++}><text>add</text></view>
</view>
