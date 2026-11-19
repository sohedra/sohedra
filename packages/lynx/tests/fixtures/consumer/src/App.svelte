<script lang="ts">
	let count = $state(0);

	// A main-thread function written in TypeScript: the build takes its types out with Node's own
	// stripper, the one part of the build that depends on the Node.js line.
	function widen(event: {
		currentTarget: { setStyleProperty(name: string, value: string): void };
	}) {
		"main thread";
		const width: number = 120;
		event.currentTarget.setStyleProperty("width", `${width}px`);
	}
</script>

<view class="counter">
	<text>Count: {count}</text>
	<view class="button" ontap={() => count++}>
		<text>Add 1</text>
	</view>
	<view class="wide" main-thread:ontap={widen}>
		<text>Widen</text>
	</view>
</view>
