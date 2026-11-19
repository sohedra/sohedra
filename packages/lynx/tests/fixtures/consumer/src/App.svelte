<script lang="ts">
	let count = $state(0);
</script>

<view class="counter">
	<text>Count: {count}</text>
	<view class="button" ontap={() => count++}>
		<text>Add 1</text>
	</view>
</view>
