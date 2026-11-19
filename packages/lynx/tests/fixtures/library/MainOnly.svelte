<script lang="ts">
	let count = $state(0);
</script>

<!-- A main-thread handler runs on the main thread alone; a plain one is the background's. -->
<view
	class="fade"
	main-thread:ontap={() => {
		"main thread";
		const g = globalThis as { mainThreadTaps?: number };
		g.mainThreadTaps = (g.mainThreadTaps ?? 0) + 1;
	}}
>
	<text>Fade</text>
</view>
<view class="add" ontap={() => count++}>
	<text>Count: {count}</text>
</view>
