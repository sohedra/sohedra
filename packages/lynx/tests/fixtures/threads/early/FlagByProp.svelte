<!--
	A tappable element in an {#if}, then a component given the background's flag as a prop, which
	renders an element of the same tag only then: the build sees no flag in its {#if}.
-->
<script lang="ts">
	import { background } from "@sohedra/lynx/environment";

	import ShownByProp from "./ShownByProp.svelte";

	let { log }: { log: unknown[] } = $props();
	const shown = true;
</script>

<view>
	{#if shown}
		<text class="tapped" ontap={() => log.push("tapped")}>tap</text>
	{/if}
	<ShownByProp show={background} {log} />
</view>
