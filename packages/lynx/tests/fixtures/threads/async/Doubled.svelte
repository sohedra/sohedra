<!-- A `$derived` of an awaited promise, which a tap changes. -->
<script lang="ts">
	let count = $state(1);
	const double = (n: number): Promise<number> => Promise.resolve(n * 2);
	let doubled = $derived(await double(count));
</script>

<view class="doubled">
	<text class="value">Doubled: {doubled}</text>
	<view class="add" ontap={() => count++}><text>add</text></view>
</view>
