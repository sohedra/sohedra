<!--
	A long press beside a part only the background renders.
-->
<script lang="ts">
	import { background } from "@sohedra/lynx/environment";

	let { log }: { log: unknown[] } = $props();
	const shown = true;
</script>

<view class="outer" onlongpress={() => log.push("outer")}>
	{#if shown}
		<text class="tapped" onlongpress={() => log.push("tapped")}>tap</text>
	{/if}
	{#if background}
		<text class="later" onlongpress={() => log.push("later")}>later</text>
	{/if}
</view>
