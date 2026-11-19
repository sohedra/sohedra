<script lang="ts">
	let {
		message = "",
		before = "",
		after = "end",
	}: { message?: string; before?: string; after?: string } = $props();
</script>

<view class="root">
	<text class="message">{message}</text>
	<text class="mixed">{before}<text class="inline">inline</text>{after}</text>
	<view class="after"><text>after</text></view>
</view>
