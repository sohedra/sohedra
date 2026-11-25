<!--
	A part picked by thread inside an {#if} both threads take: the element hydration writes over has
	the handler, and the tap is on the element under it.
-->
<script lang="ts">
	import { background } from "@sohedra/lynx/environment";
	let { log }: { log: unknown[] } = $props();
	const shown = true;
</script>

{#snippet real()}<view class="real" ontap={() => log.push("real: delete")}
		><text class="inner">x</text></view
	>{/snippet}
{#snippet skeleton()}<view class="skeleton"><text class="inner">x</text></view>{/snippet}

<view class="box">
	{#if shown}{@render (background ? real : skeleton)()}{/if}
</view>
