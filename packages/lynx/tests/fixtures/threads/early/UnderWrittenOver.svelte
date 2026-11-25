<!--
	A part picked by thread inside an {#if} both threads take: the element under the one hydration
	writes over has a handler of its own.
-->
<script lang="ts">
	import { background } from "@sohedra/lynx/environment";
	let { log }: { log: unknown[] } = $props();
	const shown = true;
</script>

{#snippet real()}<view class="real"
		><text class="inner" ontap={() => log.push("real: delete")}>x</text></view
	>{/snippet}
{#snippet skeleton()}<view class="skeleton"
		><text class="inner" ontap={() => log.push("skeleton")}>x</text></view
	>{/snippet}

<view class="box">
	{#if shown}{@render (background ? real : skeleton)()}{/if}
</view>
