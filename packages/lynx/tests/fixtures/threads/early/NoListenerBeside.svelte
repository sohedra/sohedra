<!--
	An element with no handler in an {#if}, then one of the same tag only the background renders,
	inside an element with a handler.
-->
<script lang="ts">
	import { background } from "@sohedra/lynx/environment";

	let { log }: { log: unknown[] } = $props();
	const shown = true;
</script>

<view class="outer" ontap={() => log.push("outer")}>
	{#if shown}
		<text class="plain">plain</text>
	{/if}
	{#if background}
		<text class="later" ontap={() => log.push("later")}>later</text>
	{/if}
</view>
