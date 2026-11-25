<!--
	A touch an element and its ancestor both listen for, beside a part only the background renders.
-->
<script lang="ts">
	import { background } from "@sohedra/lynx/environment";

	let { log }: { log: unknown[] } = $props();
	const shown = true;
</script>

<view class="outer" ontouchstart={() => log.push("outer")}>
	{#if shown}
		<text class="inner" ontouchstart={() => log.push("inner")}>x</text>
	{/if}
	{#if background}
		<text class="later" ontouchstart={() => log.push("later")}>y</text>
	{/if}
</view>
