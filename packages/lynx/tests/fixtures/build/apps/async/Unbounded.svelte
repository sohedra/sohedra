<!-- Awaits at the top of its script, outside any boundary: the page has no first frame. -->
<script lang="ts">
	const word = await Promise.resolve("ready");
</script>

<view class="page"><text class="word">{word}</text></view>
