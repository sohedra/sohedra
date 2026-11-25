<!--
	A tappable element in an {#if}, then one of the same tag only the background renders: the first
	frame's element has the shape of the background's last one too.
-->
<script lang="ts">
	import { background } from "@sohedra/lynx/environment";

	let { log }: { log: unknown[] } = $props();
	const shown = true;
</script>

<view class="outer" ontap={() => log.push("outer")}>
	{#if shown}
		<text class="tapped" ontap={() => log.push("tapped")}>tap</text>
	{/if}
	{#if background}
		<text class="later" ontap={() => log.push("later")}>later</text>
	{/if}
</view>
