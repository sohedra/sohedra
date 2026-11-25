<!--
	A scroll view in an {#if}, then one only the background renders: an event only a listener hears.
-->
<script lang="ts">
	import { background } from "@sohedra/lynx/environment";

	let { log }: { log: unknown[] } = $props();
	const shown = true;
</script>

<view>
	{#if shown}
		<scroll-view class="scroller" onscroll={() => log.push("scroller")}></scroll-view>
	{/if}
	{#if background}
		<scroll-view class="later" onscroll={() => log.push("later")}></scroll-view>
	{/if}
</view>
