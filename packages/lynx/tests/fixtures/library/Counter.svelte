<script lang="ts">
	let { step = 1 }: { step?: number } = $props();

	let count = $state(0);
</script>

<view class="counter">
	<text>Count: {count}</text>
	<view class="button" ontap={() => (count += step)}>
		<text>Add {step}</text>
	</view>
</view>
