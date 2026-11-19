<!-- A main-thread function that captures a $state object, which is then given its own proxy to hold. -->
<script lang="ts">
	let { api }: { api: Record<string, unknown> } = $props();
	let box = $state<{ v: number; self?: unknown }>({ v: 0 });
	let count = $state(0);

	api["count"] = () => count++;
	api["cycle"] = () => (box.self = box);

	function onTap() {
		"main thread";
		console.log(box);
	}
</script>

<view class="before"><text>count {count}</text></view>
<view class="tap" main-thread:ontap={onTap}><text>tap</text></view>
